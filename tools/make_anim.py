#!/usr/bin/env python3
"""帧动画抠图对齐 (Animation Chroma Key + Alignment)

把"同一动作序列"的多张纯绿幕帧抠成透明，并**共享同一裁剪框与缩放**，
保证逐帧之间人物锚定一致——这是干净帧动画（呼吸/摇摆/挥手等）的关键。

与 chroma_key.py 的区别：
  - chroma_key.py 对**单张**图各自裁剪+归一，帧间会错位；
  - make_anim.py 对**一组帧**取 alpha 包围盒的并集统一裁剪，再统一缩放，帧间对齐。

用法：
  python3 make_anim.py <帧目录或多个文件> -o <输出目录> [--height 1400] [--pad 0.03] [--webp] [--sheet]
  # 帧按文件名排序作为播放顺序；输出 frame_00.(webp|png) ... 及可选 sheet.png + anim.json
"""
import argparse
import json
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

# 复用 chroma_key 的核心算法
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chroma_key import estimate_key_color, build_alpha, despill, feather_alpha


def key_frame(path, tol_low, tol_high):
    """单帧抠图（不裁剪），返回 RGBA 的 numpy 数组 (H,W,4) uint8。"""
    src = Image.open(path).convert("RGB")
    arr = np.asarray(src).astype(np.float32) / 255.0
    key = estimate_key_color(np.asarray(src).astype(np.float32))
    alpha = build_alpha(arr, key, tol_low, tol_high)
    rgb = despill(arr, alpha)
    rgb8 = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)
    alpha_img = feather_alpha(Image.fromarray((alpha * 255).astype(np.uint8), mode="L"))
    out = Image.fromarray(rgb8, mode="RGB").convert("RGBA")
    out.putalpha(alpha_img)
    return out


def _denoise_mask(a, thresh=60):
    """二值化 + 形态学开运算去掉孤立小绿斑，得到稳健的人物主体掩膜。"""
    m = Image.fromarray(((a > thresh) * 255).astype(np.uint8), mode="L")
    # 开运算：先腐蚀去小点，再膨胀复原主体
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    return np.asarray(m) > 127


def union_bbox(frames, thresh=60):
    """所有帧"去噪后主体掩膜"包围盒的并集（避免边缘绿斑撑大画布）。"""
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for im in frames:
        a = np.asarray(im)[..., 3]
        mask = _denoise_mask(a, thresh)
        ys, xs = np.where(mask)
        if len(xs) == 0:
            continue
        x0 = min(x0, xs.min()); y0 = min(y0, ys.min())
        x1 = max(x1, xs.max()); y1 = max(y1, ys.max())
    if x1 < 0:
        return None
    return x0, y0, x1, y1


def main():
    ap = argparse.ArgumentParser(description="帧动画抠图+对齐")
    ap.add_argument("inputs", nargs="+", help="帧目录 或 多个帧文件（按名排序为播放顺序）")
    ap.add_argument("-o", "--out", required=True, help="输出目录")
    ap.add_argument("--height", type=int, default=1400, help="统一输出高度(px)")
    ap.add_argument("--pad", type=float, default=0.03, help="并集框留白比例")
    ap.add_argument("--webp", action="store_true", help="输出 webp（默认 png）")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--sheet", action="store_true", help="额外输出横向精灵图 sheet.png + anim.json")
    ap.add_argument("--tol-low", type=float, default=0.16)
    ap.add_argument("--tol-high", type=float, default=0.42)
    args = ap.parse_args()

    # 收集帧文件
    files = []
    for inp in args.inputs:
        if os.path.isdir(inp):
            files += [os.path.join(inp, f) for f in sorted(os.listdir(inp))
                      if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
        else:
            files.append(inp)
    if not files:
        print("没有找到帧", file=sys.stderr); sys.exit(1)

    os.makedirs(args.out, exist_ok=True)
    frames = [key_frame(f, args.tol_low, args.tol_high) for f in files]

    # 统一画布尺寸（若帧分辨率不同，先 pad 到最大）
    W = max(im.width for im in frames); H = max(im.height for im in frames)
    canvas = []
    for im in frames:
        if im.size != (W, H):
            c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            c.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
            im = c
        canvas.append(im)

    # 并集包围盒 + 统一裁剪
    bb = union_bbox(canvas)
    if bb is None:
        print("全透明，检查绿幕", file=sys.stderr); sys.exit(1)
    x0, y0, x1, y1 = bb
    pad = int(round(max(W, H) * args.pad))
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(W - 1, x1 + pad); y1 = min(H - 1, y1 + pad)
    cw, ch = x1 - x0 + 1, y1 - y0 + 1

    # 统一缩放比例
    scale = args.height / ch if args.height > 0 else 1.0
    out_w = max(1, int(round(cw * scale)))
    out_h = max(1, int(round(ch * scale))) if args.height > 0 else ch

    ext = "webp" if args.webp else "png"
    out_frames = []
    for i, im in enumerate(canvas):
        # 去除远离主体的孤立绿斑：用膨胀后的主体掩膜遮罩 alpha（保留人物边缘软过渡）
        rgba = np.asarray(im).copy()
        body = _denoise_mask(rgba[..., 3], thresh=50)
        keep = Image.fromarray((body * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(9))
        keep = np.asarray(keep.filter(ImageFilter.GaussianBlur(2))) / 255.0
        rgba[..., 3] = np.clip(rgba[..., 3] * keep, 0, 255).astype(np.uint8)
        im = Image.fromarray(rgba, "RGBA")
        cropped = im.crop((x0, y0, x1 + 1, y1 + 1))
        if scale != 1.0:
            cropped = cropped.resize((out_w, out_h), Image.LANCZOS)
        out_frames.append(cropped)
        p = os.path.join(args.out, f"frame_{i:02d}.{ext}")
        if args.webp:
            cropped.save(p, "WEBP", quality=args.quality, method=6)
        else:
            cropped.save(p)
        print(f"  ✓ {os.path.basename(files[i])} -> {p}  {cropped.size}")

    if args.sheet:
        n = len(out_frames)
        sheet = Image.new("RGBA", (out_w * n, out_h), (0, 0, 0, 0))
        for i, im in enumerate(out_frames):
            sheet.paste(im, (i * out_w, 0))
        sheet.save(os.path.join(args.out, "sheet.png"))
        meta = {"frames": n, "frameWidth": out_w, "frameHeight": out_h}
        with open(os.path.join(args.out, "anim.json"), "w") as fp:
            json.dump(meta, fp, ensure_ascii=False, indent=2)
        print(f"  ✓ sheet.png ({out_w*n}x{out_h}) + anim.json")


if __name__ == "__main__":
    main()
