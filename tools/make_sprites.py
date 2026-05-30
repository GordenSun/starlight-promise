#!/usr/bin/env python3
"""序列帧 / 精灵图烘焙 (Sprite Sheet Baker)

把一张「抠像后的透明立绘」烘焙成一段「呼吸 + 轻微摇摆」的循环序列帧，
并拼装为一张精灵图(sprite sheet)+ JSON 元数据。

这是完整复现需求中「绿幕立绘 → 抠像 → 序列帧动画」流程的离线产物：
  绿幕原图  --chroma_key.py-->  透明 PNG  --make_sprites.py-->  序列帧/精灵图

注意：游戏运行时为了体积与清晰度，默认采用「单张透明 PNG + 逐帧实时变换」
的方式驱动同样的呼吸/摇摆动画（见 js/engine/stage.js）。本工具用于离线生成
可直接播放的序列帧资源，二者动画原理一致。

用法：
  python3 make_sprites.py <透明PNG> -o <输出目录> [--frames 24] [--fps 12]
"""
import argparse
import json
import math
import os
import numpy as np
from PIL import Image


def bake(img: Image.Image, frames: int, breathe_amp: float, sway_deg: float, sway_px: int):
    """返回 [Image, ...]，每帧尺寸一致(=原图尺寸)，底部锚定。"""
    w, h = img.size
    out = []
    for i in range(frames):
        t = i / frames
        phase = 2 * math.pi * t
        sy = 1.0 + breathe_amp * math.sin(phase)            # 呼吸：纵向缩放
        ang = sway_deg * math.sin(phase * 0.5)              # 摇摆：旋转
        dx = int(round(sway_px * math.sin(phase * 0.5)))    # 摇摆：水平位移

        # 纵向缩放（底部锚定）
        nh = max(1, int(round(h * sy)))
        scaled = img.resize((w, nh), Image.LANCZOS)
        # 旋转（围绕底部中心）
        rot = scaled.rotate(ang, resample=Image.BICUBIC, expand=True, center=(w / 2, nh))
        # 合成到固定画布，底部对齐
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        rx = (w - rot.width) // 2 + dx
        ry = h - rot.height
        canvas.alpha_composite(rot, (rx, ry))
        out.append(canvas)
    return out


def pack(frames, cols):
    n = len(frames)
    fw, fh = frames[0].size
    rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (fw * cols, fh * rows), (0, 0, 0, 0))
    for idx, fr in enumerate(frames):
        r, c = divmod(idx, cols)
        sheet.alpha_composite(fr, (c * fw, r * fh))
    return sheet, fw, fh, rows


def main():
    ap = argparse.ArgumentParser(description='烘焙呼吸/摇摆序列帧精灵图')
    ap.add_argument('input', help='透明 PNG 立绘')
    ap.add_argument('-o', '--out', default='sprites', help='输出目录')
    ap.add_argument('--frames', type=int, default=24)
    ap.add_argument('--fps', type=int, default=12)
    ap.add_argument('--cols', type=int, default=6)
    ap.add_argument('--breathe', type=float, default=0.018, help='呼吸幅度(纵向缩放)')
    ap.add_argument('--sway', type=float, default=0.8, help='摇摆角度(度)')
    ap.add_argument('--swaypx', type=int, default=6, help='摇摆水平位移(px)')
    ap.add_argument('--maxh', type=int, default=900, help='先把立绘缩到该高度再烘焙，控制体积')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    img = Image.open(args.input).convert('RGBA')
    if args.maxh and img.height > args.maxh:
        scale = args.maxh / img.height
        img = img.resize((int(img.width * scale), args.maxh), Image.LANCZOS)

    name = os.path.splitext(os.path.basename(args.input))[0]
    frames = bake(img, args.frames, args.breathe, args.sway, args.swaypx)
    sheet, fw, fh, rows = pack(frames, args.cols)

    sheet_path = os.path.join(args.out, name + '_sheet.png')
    sheet.save(sheet_path)
    meta = {
        'image': os.path.basename(sheet_path),
        'frameWidth': fw, 'frameHeight': fh,
        'frames': args.frames, 'cols': args.cols, 'rows': rows,
        'fps': args.fps, 'loop': True, 'anchor': 'bottom-center',
    }
    with open(os.path.join(args.out, name + '_sheet.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f'  ✓ {sheet_path}  ({fw}x{fh} × {args.frames}帧, {args.cols}×{rows})')
    print(f'  ✓ {os.path.join(args.out, name + "_sheet.json")}')


if __name__ == '__main__':
    main()
