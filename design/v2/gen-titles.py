#!/usr/bin/env python3
# 出 6 套「集结杯」标题艺术字图，对齐 design v2 皮肤专属质感 × 明暗。robust 字体 fallback。
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/Users/bytedance/项目/jijiebei/assets/resources/images/brand"
TEXT = "集结杯"
W, H, FS = 660, 240, 150

SERIF = ["/System/Library/Fonts/Supplemental/Songti.ttc"]                       # 宋体衬线 → metal
SANS = ["/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc"]                        # 黑体 → sc2/minimal

def lf(cands):
    for p in cands:
        try:
            return ImageFont.truetype(p, FS)
        except Exception:
            continue
    raise Exception("no usable font in " + str(cands))

def vgrad(top, bot):
    g = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(g)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(
            int(top[0]+(bot[0]-top[0])*t), int(top[1]+(bot[1]-top[1])*t), int(top[2]+(bot[2]-top[2])*t), 255))
    return g

def make(name, cands, top, bot, stroke, sw, shadow):
    f = lf(cands)
    mask = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mask)
    bbox = md.textbbox((0, 0), TEXT, font=f); tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    x, y = (W-tw)//2 - bbox[0], (H-th)//2 - bbox[1]
    md.text((x, y), TEXT, font=f, fill=255)
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if shadow:
        if isinstance(shadow, tuple):  # 彩色外发光(居中大 blur，仿 design text-shadow 0 0 16px)
            gl = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(gl).text((x, y), TEXT, font=f, fill=shadow + (225,))
            base = Image.alpha_composite(base, gl.filter(ImageFilter.GaussianBlur(15)))
        else:  # 黑色投影
            sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).text((x, y+3), TEXT, font=f, fill=(0, 0, 0, 150))
            base = Image.alpha_composite(base, sh.filter(ImageFilter.GaussianBlur(5)))
    if stroke and sw > 0:
        st = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(st).text((x, y), TEXT, font=f, fill=stroke+(255,), stroke_width=sw, stroke_fill=stroke+(255,))
        base = Image.alpha_composite(base, st)
    grad = vgrad(top, bot); grad.putalpha(mask)
    base = Image.alpha_composite(base, grad)
    base.save(OUT + "/jjb-title-" + name + ".png"); print(name, "ok")

CONFIGS = [
    ("metal-dark",    SERIF, (240,216,144), (199,154,62),  (58,44,16),     3, True),
    ("metal-light",   SERIF, (98,70,18),    (47,33,5),     (214,182,120),  1, False),
    ("sc2-dark",      SANS,  (223,234,230), (205,219,213),  None,           0, (86,207,140)),
    ("sc2-light",     SANS,  (30,82,54),    (18,58,38),    None,           0, False),
    ("minimal-dark",  SANS,  (241,243,246), (205,210,218), None,           0, False),
    ("minimal-light", SANS,  (32,38,48),    (16,20,28),    None,           0, False),
]
for c in CONFIGS:
    make(*c)
