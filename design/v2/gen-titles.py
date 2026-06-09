#!/usr/bin/env python3
# 出 6 套「集结杯」标题艺术字。亮版按 design styles.css 175-186 修正：
#   faux-bold（描边同色加粗→ design 900/700 字重，补偿深字在浅底光学偏细）+ 白色 1px 高光（浅底浮雕）+ design 精确色。
#   暗版配置不变（已验收，不回归）。
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/Users/bytedance/项目/jijiebei/assets/resources/images/brand"
TEXT = "集结杯"
W, H, FS = 660, 240, 150

SERIF = ["/System/Library/Fonts/Supplemental/Songti.ttc"]
SANS = ["/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc"]

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

def make(name, cands, top, bot, stroke, sw, shadow, bold=0, hi=0):
    f = lf(cands)
    mask = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mask)
    bbox = md.textbbox((0, 0), TEXT, font=f, stroke_width=bold); tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    x, y = (W-tw)//2 - bbox[0], (H-th)//2 - bbox[1]
    md.text((x, y), TEXT, font=f, fill=255, stroke_width=bold, stroke_fill=255)   # bold 字形进 mask（faux-bold 加粗）
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if hi > 0:  # 白色 1px 高光（design 浅底 text-shadow 0 1px 0 white）：同形下移 2px 垫底，主字盖上后露出底缘白边
        hm = Image.new("L", (W, H), 0); ImageDraw.Draw(hm).text((x, y+2), TEXT, font=f, fill=hi, stroke_width=bold, stroke_fill=hi)
        wl = Image.new("RGBA", (W, H), (255, 255, 255, 0)); wl.putalpha(hm)
        base = Image.alpha_composite(base, wl)
    if shadow:
        if isinstance(shadow, tuple):  # 彩色外发光（暗版 sc2）
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
    # name            font   top              bot              stroke         sw  shadow            bold hi
    ("metal-dark",    SERIF, (240,216,144),   (199,154,62),    (58,44,16),    3,  True,             0,   0),
    ("sc2-dark",      SANS,  (223,234,230),   (205,219,213),   None,          0,  (86,207,140),     0,   0),
    ("minimal-dark",  SANS,  (241,243,246),   (205,210,218),   None,          0,  False,            0,   0),
    # 亮版（design styles.css 175-186）：faux-bold 补字重 + 白高光浮雕 + 精确色
    ("metal-light",   SERIF, (138,101,22),    (47,33,5),       None,          0,  False,            3,   140),  # #8a6516→#2f2105, hi .55
    ("sc2-light",     SANS,  (18,58,38),      (18,58,38),      None,          0,  False,            2,   128),  # 实色 #123a26, hi .5
    ("minimal-light", SANS,  (17,21,28),      (17,21,28),      None,          0,  False,            4,   102),  # 实色 #11151c, hi .4, 900
]
for c in CONFIGS:
    make(*c)
print("done")
