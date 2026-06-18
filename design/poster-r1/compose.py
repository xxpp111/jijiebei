#!/usr/bin/env python3
"""集结杯海报 R1 — 合成：无字底图 + 金三角 + 集结杯金字 + 口号/副标题/信息 + CM logo。
用法： python3 design/poster-r1/compose.py [bg_variant]   # 默认 duo
输出： out/poster-r1.png （1080x1350, 4:5）
位置常量集中在 LAYOUT，看图后微调。
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(__file__)
PROJ = os.path.abspath(os.path.join(ROOT, "..", ".."))
SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
HEI = "/System/Library/Fonts/STHeiti Medium.ttc"
PING = "/System/Library/Fonts/PingFang.ttc"

W, H = 1080, 1350

# 配色
GOLD = (232, 194, 102)
GOLD_HI = (245, 222, 150)
GOLD_DK = (183, 137, 58)
SILVER = (216, 224, 233)
WHITE = (240, 243, 246)
INK = (10, 18, 32)

LAYOUT = dict(
    bg_offset_y=0,        # 底图裁切起点（top-align=0；正数下移裁窗=保留更下方）
    logo_h=72, logo_top=46,
    coop_y=126,           # 「星际争霸II · 合作任务」
    title_cy=600,         # 集结杯金字中心 y
    title_w=720,          # 集结杯金字目标宽
    tri_cy=596, tri_w=560, tri_h=470,   # 金三角
    slogan_y=812,         # 星际英雄 在此集结
    regroup_y=872,        # REGROUP YOUR FORCES
    sub_y=928,            # — 双打挑战赛 —
    info_y0=1118, info_dy=58,   # 信息三行起点 + 行距
    info_bar_top=1078,    # 底部信息暗条顶
)


def load_font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def draw_spaced(draw, cx, y, text, font, fill, spacing=0, stroke_w=0, stroke_fill=None, anchor_top=True):
    """字间距居中绘制，返回 (左x, 宽)。"""
    widths = []
    for ch in text:
        b = draw.textbbox((0, 0), ch, font=font, stroke_width=stroke_w)
        widths.append(b[2] - b[0])
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        b = draw.textbbox((0, 0), ch, font=font, stroke_width=stroke_w)
        draw.text((x - b[0], y - (b[1] if anchor_top else 0)), ch, font=font,
                  fill=fill, stroke_width=stroke_w, stroke_fill=stroke_fill)
        x += w + spacing
    return cx - total / 2, total


def cover(im, w, h, offset_y=0):
    """等比缩放铺满 w×h 后裁切。offset_y 调整裁窗起点。"""
    s = max(w / im.width, h / im.height)
    nw, nh = int(im.width * s + 0.5), int(im.height * s + 0.5)
    im = im.resize((nw, nh), Image.LANCZOS)
    x = (nw - w) // 2
    y = max(0, min(nh - h, (nh - h) // 2 + offset_y))
    return im.crop((x, y, x + w, y + h))


def vignette(size, edge=0.55, bottom=0.92):
    """边缘 + 底部加深遮罩（RGBA 黑，alpha 渐变）。"""
    w, h = size
    m = Image.new("L", (w, h), 0)
    px = m.load()
    import math
    cx, cy = w / 2, h * 0.42
    maxd = math.hypot(cx, cy)
    for y in range(h):
        for x in range(0, w, 2):
            d = math.hypot(x - cx, y - cy) / maxd
            v = int(max(0, (d - 0.5)) * 2 * 150 * edge)
            # 底部额外加深
            if y > h * 0.7:
                v += int((y - h * 0.7) / (h * 0.3) * 150 * bottom)
            v = min(235, v)
            px[x, y] = v
            if x + 1 < w:
                px[x + 1, y] = v
    out = Image.new("RGBA", (w, h), (5, 10, 20, 0))
    out.putalpha(m)
    return out


def gold_triangle(w, h, lw=4):
    """金色描边等边三角（尖朝上），透明 PNG + 柔光。"""
    pad = 40
    cv = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    ox, oy = pad, pad
    pts = [(w / 2 + ox, oy), (ox, h + oy), (w + ox, h + oy)]
    d.line(pts + [pts[0]], fill=GOLD + (235,), width=lw, joint="curve")
    glow = cv.filter(ImageFilter.GaussianBlur(7))
    out = Image.new("RGBA", cv.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, cv)
    return out


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else "duo"
    L = LAYOUT
    bg_path = os.path.join(ROOT, "art", f"bg-{variant}.png")
    if not os.path.exists(bg_path):
        sys.exit(f"底图不存在：{bg_path}（先跑 gen_bg.py {variant}）")

    canvas = cover(Image.open(bg_path).convert("RGBA"), W, H, L["bg_offset_y"])
    canvas = Image.alpha_composite(canvas, vignette((W, H)))

    # 金三角（标题后）
    tri = gold_triangle(L["tri_w"], L["tri_h"])
    canvas.alpha_composite(tri, (int(W / 2 - tri.width / 2), int(L["tri_cy"] - tri.height / 2)))

    # 集结杯金字
    title = Image.open(os.path.join(ROOT, "work", "title-kaiti.png")).convert("RGBA")
    tw = L["title_w"]
    th = int(title.height * tw / title.width)
    title = title.resize((tw, th), Image.LANCZOS)
    canvas.alpha_composite(title, (int(W / 2 - tw / 2), int(L["title_cy"] - th / 2)))

    d = ImageDraw.Draw(canvas)

    # 顶部 CM logo
    logo = Image.open(os.path.join(PROJ, "assets/resources/images/brand/logo-cm-gold.png")).convert("RGBA")
    lh = L["logo_h"]
    lw = int(logo.width * lh / logo.height)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    canvas.alpha_composite(logo, (int(W / 2 - lw / 2), L["logo_top"]))

    # 星际争霸II · 合作任务
    f_coop = load_font(HEI, 30)
    draw_spaced(d, W / 2, L["coop_y"], "星际争霸 II · 合作任务", f_coop, SILVER, spacing=4,
                stroke_w=3, stroke_fill=INK)

    # 口号
    f_slogan = load_font(SONGTI, 50, index=2)  # 粗宋，衬线庄重
    draw_spaced(d, W / 2, L["slogan_y"], "星 际 英 雄　在 此 集 结", f_slogan, GOLD_HI, spacing=6,
                stroke_w=4, stroke_fill=INK)
    f_reg = load_font(HEI, 24)
    draw_spaced(d, W / 2, L["regroup_y"], "REGROUP YOUR FORCES", f_reg, SILVER, spacing=10,
                stroke_w=3, stroke_fill=INK)

    # 副点题 — 双打挑战赛 —
    f_sub = load_font(HEI, 40)
    lx, lw2 = draw_spaced(d, W / 2, L["sub_y"], "双 打 挑 战 赛", f_sub, GOLD, spacing=8,
                          stroke_w=4, stroke_fill=INK)
    # 两侧装饰短线
    ly = L["sub_y"] + 28
    d.line([(lx - 70, ly), (lx - 18, ly)], fill=GOLD + (220,), width=3)
    d.line([(lx + lw2 + 18, ly), (lx + lw2 + 70, ly)], fill=GOLD + (220,), width=3)

    # 底部信息暗条
    bar = Image.new("RGBA", (W, H - L["info_bar_top"]), (6, 12, 24, 150))
    canvas.alpha_composite(bar, (0, L["info_bar_top"]))
    d = ImageDraw.Draw(canvas)
    f_info = load_font(HEI, 36)
    f_info_b = load_font(HEI, 38)
    rows = [
        ("比赛群　965786418", WHITE, f_info),
        ("CM 群　517072", SILVER, f_info),
        ("儒雅随和の土豆　＆　CM　联合出品", GOLD_HI, f_info_b),
    ]
    for i, (txt, col, fnt) in enumerate(rows):
        draw_spaced(d, W / 2, L["info_y0"] + i * L["info_dy"], txt, fnt, col, spacing=2,
                    stroke_w=3, stroke_fill=INK)

    out = os.path.join(ROOT, "out", "poster-r1.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.convert("RGB").save(out, quality=95)
    print(f"saved {out}  {canvas.size}  bg={variant}")


if __name__ == "__main__":
    main()
