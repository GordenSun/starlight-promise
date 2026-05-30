#!/usr/bin/env python3
"""绿幕抠图流水线 (Chroma Key)

把生成的"纯绿幕背景"立绘抠成透明背景 PNG。
做法：
  1. 采样四角估计背景绿色；
  2. 用 greenness = G - max(R,B) 与背景相似度联合计算 alpha（带软边过渡）；
  3. 去绿溢色 (despill)：把溢到人物边缘的绿色压回自然色；
  4. 羽化 / 收边，消除绿色毛边；
  5. 自动裁剪到人物外接框，并可统一画布高度，便于游戏内等比缩放。

用法：
  python3 chroma_key.py <输入文件或目录> -o <输出目录> [--height 1280] [--pad 0.04]
"""
import argparse
import os
import sys
import numpy as np
from PIL import Image, ImageFilter


def estimate_key_color(arr: np.ndarray, border: int = 24) -> np.ndarray:
    """从四边采样估计背景关键色（绿幕）。"""
    h, w, _ = arr.shape
    b = min(border, h // 8, w // 8)
    samples = np.concatenate([
        arr[:b, :, :].reshape(-1, 3),
        arr[-b:, :, :].reshape(-1, 3),
        arr[:, :b, :].reshape(-1, 3),
        arr[:, -b:, :].reshape(-1, 3),
    ], axis=0)
    # 只取偏绿的样本求中位数，避免角落里有人物
    greenish = samples[(samples[:, 1] > samples[:, 0]) & (samples[:, 1] > samples[:, 2])]
    if len(greenish) < 50:
        greenish = samples
    return np.median(greenish, axis=0)


def build_alpha(arr: np.ndarray, key: np.ndarray,
                tol_low: float = 0.16, tol_high: float = 0.42) -> np.ndarray:
    """返回 [0,1] 浮点 alpha：1 不透明（人物），0 透明（背景）。"""
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # 绿色优势度：背景绿幕该值很高，人物（皮肤/头发/衣服）通常很低或为负
    greenness = g - np.maximum(r, b)

    # 与关键色的色彩接近度（在偏绿区域增强背景判定）
    kr, kg, kb = key / 255.0
    dist = np.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)
    close_to_key = np.clip(1.0 - dist / 0.35, 0.0, 1.0)

    score = greenness * (0.65 + 0.35 * close_to_key)

    alpha = np.clip((tol_high - score) / (tol_high - tol_low), 0.0, 1.0)
    return alpha.astype(np.float32)


def despill(arr: np.ndarray, alpha: np.ndarray, strength: float = 0.9) -> np.ndarray:
    """去除溢到人物上的绿色（绿边/绿反光）。"""
    out = arr.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    cap = np.maximum(r, b)
    over = g - cap
    mask = over > 0
    g[mask] = g[mask] - over[mask] * strength
    out[..., 1] = g
    return out


def feather_alpha(alpha_img: Image.Image, radius: float = 0.8, contract: float = 1.0) -> Image.Image:
    """轻微羽化 + 收边，去掉残留绿色毛边。"""
    a = alpha_img
    if contract > 0:
        # 用 MinFilter 收缩 1px，去掉边缘半透明绿圈
        a = a.filter(ImageFilter.MinFilter(3))
    if radius > 0:
        a = a.filter(ImageFilter.GaussianBlur(radius))
    return a


def autocrop(im: Image.Image, pad_frac: float = 0.03, alpha_thresh: int = 12):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > alpha_thresh)
    if len(xs) == 0:
        return im
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    w, h = im.size
    pad = int(round(max(w, h) * pad_frac))
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad); y1 = min(h - 1, y1 + pad)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def normalize_height(im: Image.Image, target_h: int):
    if target_h <= 0:
        return im
    w, h = im.size
    scale = target_h / h
    return im.resize((max(1, int(round(w * scale))), target_h), Image.LANCZOS)


def process_image(path: str, target_h: int = 0, pad: float = 0.03,
                  tol_low: float = 0.16, tol_high: float = 0.42) -> Image.Image:
    src = Image.open(path).convert("RGB")
    arr = np.asarray(src).astype(np.float32) / 255.0

    key = estimate_key_color(np.asarray(src).astype(np.float32))
    alpha = build_alpha(arr, key, tol_low, tol_high)

    rgb = despill(arr, alpha)
    rgb8 = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)

    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8), mode="L")
    alpha_img = feather_alpha(alpha_img)

    out = Image.fromarray(rgb8, mode="RGB").convert("RGBA")
    out.putalpha(alpha_img)

    out = autocrop(out, pad_frac=pad)
    out = normalize_height(out, target_h)
    return out


def main():
    ap = argparse.ArgumentParser(description="绿幕抠图为透明 PNG")
    ap.add_argument("input", help="输入图片或目录")
    ap.add_argument("-o", "--out", default="out", help="输出目录")
    ap.add_argument("--height", type=int, default=0, help="统一输出高度(px)，0=不缩放")
    ap.add_argument("--pad", type=float, default=0.03, help="裁剪留白比例")
    ap.add_argument("--tol-low", type=float, default=0.16)
    ap.add_argument("--tol-high", type=float, default=0.42)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    if os.path.isdir(args.input):
        files = [os.path.join(args.input, f) for f in sorted(os.listdir(args.input))
                 if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
    else:
        files = [args.input]

    if not files:
        print("没有找到输入图片", file=sys.stderr)
        sys.exit(1)

    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        out_path = os.path.join(args.out, name + ".png")
        im = process_image(f, target_h=args.height, pad=args.pad,
                            tol_low=args.tol_low, tol_high=args.tol_high)
        im.save(out_path)
        print(f"  ✓ {f}  ->  {out_path}  {im.size}")


if __name__ == "__main__":
    main()
