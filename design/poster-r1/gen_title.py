#!/usr/bin/env python3
"""集结杯海报 R1 — 「集结杯」金属金大字（透明 PNG）。

系统无楷体（Kaiti.ttc 不存在），改用 Songti.ttc index 0 = Songti SC Black
（最黑、最庄重的宋体）做金字，金属描边比楷体更有电竞硬朗感。
输出： design/poster-r1/work/title-kaiti.png （高清出图，compose.py 缩放到宽 720）
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(__file__)
SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
TEXT = "集结杯"
FSIZE = 400
SPACING = 46          # 字间距
STROKE = 16           # 深墨描边宽
INK = (8, 14, 26)

# 金属竖向渐变（位置 0..1 → RGB），0.52 处一道反光暗带是金属感关键
GRAD = [
    (0.00, (255, 241, 188)),
    (0.30, (238, 200, 112)),
    (0.52, (150, 110, 45)),
    (0.66, (247, 216, 142)),
    (1.00, (190, 150, 78)),
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad_color(rel):
    rel = min(1.0, max(0.0, rel))
    for i in range(len(GRAD) - 1):
        p0, c0 = GRAD[i]
        p1, c1 = GRAD[i + 1]
        if p0 <= rel <= p1:
            return lerp(c0, c1, (rel - p0) / (p1 - p0))
    return GRAD[-1][1]


def main():
    font = ImageFont.truetype(SONGTI, FSIZE, index=0)
    measure = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bboxes = [measure.textbbox((0, 0), ch, font=font, stroke_width=STROKE) for ch in TEXT]
    widths = [b[2] - b[0] for b in bboxes]
    asc, desc = font.getmetrics()
    pad = 64
    W = sum(widths) + SPACING * (len(TEXT) - 1) + STROKE * 2 + pad * 2
    H = asc + desc + STROKE * 2 + pad * 2

    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))   # 深墨描边层（字面透明）
    db = ImageDraw.Draw(base)
    mask = Image.new("L", (W, H), 0)                 # 字面 mask（实心）
    dm = ImageDraw.Draw(mask)
    y_draw = pad
    x = pad + STROKE
    for ch, b, w in zip(TEXT, bboxes, widths):
        gx = x - b[0]
        db.text((gx, y_draw), ch, font=font, fill=(0, 0, 0, 0),
                stroke_width=STROKE, stroke_fill=INK + (255,))
        dm.text((gx, y_draw), ch, font=font, fill=255)
        x += w + SPACING

    box = mask.getbbox()
    y0, y1 = box[1], box[3]
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))   # 金属竖向渐变，逐行画
    dg = ImageDraw.Draw(grad)
    for yy in range(H):
        c = grad_color((yy - y0) / max(1, y1 - y0))
        dg.line([(0, yy), (W, yy)], fill=c + (255,))
    grad.putalpha(mask)                              # 字面 mask 当 alpha

    out_img = Image.alpha_composite(base, grad)
    out_dir = os.path.join(ROOT, "work")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "title-kaiti.png")
    out_img.save(out)
    print("saved %s  %s" % (out, out_img.size))


if __name__ == "__main__":
    main()
