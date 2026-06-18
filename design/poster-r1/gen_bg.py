#!/usr/bin/env python3
"""集结杯海报 R1 — GPT-image-2 生成无字底图（不走 Dubhe，字节 ModelHub 直连）。

用法： python3 design/poster-r1/gen_bg.py [duo|trio|atmos] [size]
       默认 variant=duo，size=1024x1536（竖版，贴海报 4:5，compose 裁切损失最小）
       如 API 不支持竖版可 fallback： python3 ... duo 1536x1024
输出： design/poster-r1/art/bg-<variant>.png  （无字底图，中文标题后续 compose 叠 Label）
key ： 读 ~/.config/jijiebei/modelhub.env 的 MODELHUB_AK（不入库），或同名环境变量。
"""
import base64, json, os, sys, time, urllib.request

API = "https://aidp.bytedance.net/api/modelhub/online/v2/crawl/openai/images/generations"
ROOT = os.path.dirname(__file__)
ENVFILE = os.path.expanduser("~/.config/jijiebei/modelhub.env")
DEFAULT_SIZE = "1024x1536"   # 竖版


def load_ak():
    """环境变量优先，否则读 env 文件（MODELHUB_AK=xxx）。"""
    ak = os.environ.get("MODELHUB_AK")
    if ak:
        return ak.strip()
    if os.path.exists(ENVFILE):
        for line in open(ENVFILE):
            line = line.strip()
            if line.startswith("export "):
                line = line[7:].strip()
            if line.startswith("MODELHUB_AK"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("MODELHUB_AK 缺失：环境变量与 %s 都没有" % ENVFILE)


# 所有 variant 共享的硬约束 + 版面预留（无字、三色、竖版、留标题/logo/信息位）
COMMON = (
    "CRITICAL — ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LOGOS, NO WATERMARKS, "
    "NO UI ELEMENTS, NO CAPTIONS anywhere in the image. "
    "A vertical 4:5 portrait poster background (key art) for a StarCraft II Co-op Missions esports tournament. "
    "STRICT three-color palette only: deep navy #0E1726 as the dominant base, metallic gold (#B8893A to #E8C266) "
    "as rim light and accents, cool silver #DCE4ED as cold highlights. "
    "Cinematic, serious, epic esports key-art mood; dramatic volumetric rim light; atmospheric haze, drifting embers, "
    "smoke and depth; high detail. "
    "LAYOUT RESERVES (keep these zones dark, clean and low-detail): top 12 percent darker to host a logo; "
    "the CENTER band from 35 to 60 percent height MUST be darker and uncluttered to host a large title overlay; "
    "bottom 24 percent a heavily darkened gradient to host an info bar."
)

PROMPTS = {
    "duo": COMMON + " MAIN SUBJECT: two heroic StarCraft II co-op commanders standing shoulder to shoulder "
    "in the lower-center, strong dramatic silhouettes lit by golden rim light, facing a vast battlefield horizon, "
    "conveying alliance, partnership and resolve (this is a doubles / 2-player tournament). "
    "Sci-fi power armor, distant war, embers and god-rays behind them.",
    "trio": COMMON + " MAIN SUBJECT: the three factions of StarCraft II (Terran, Zerg, Protoss) converging as a grand "
    "three-way alliance in the lower-center, epic silhouettes and faction iconography, golden energy lines, "
    "set against a navy battlefield horizon with god-rays.",
    "atmos": COMMON + " MAIN SUBJECT: pure atmospheric battlefield with no characters — a vast navy sci-fi war horizon, "
    "golden god-rays piercing smoke, drifting embers, minimal and clean, leaving a generous dark empty center "
    "for title overlays.",
}


def gen(variant, size):
    ak = load_ak()
    body = json.dumps({"model": "gpt-image-2", "prompt": PROMPTS[variant],
                       "n": 1, "size": size, "quality": "high"}).encode()
    req = urllib.request.Request(
        "%s?ak=%s" % (API, ak), data=body, method="POST",
        headers={"Content-Type": "application/json", "api-key": ak,
                 "X-TT-LOGID": "jjb-poster-%d" % int(time.time())})
    print("→ POST gpt-image-2  variant=%s  size=%s ..." % (variant, size))
    t0 = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=600).read()
    except urllib.error.HTTPError as e:
        sys.exit("HTTP %s：%s" % (e.code, e.read()[:600]))
    p = json.loads(resp)
    if not p.get("data") or "b64_json" not in p["data"][0]:
        sys.exit("返回缺 data/b64_json：%s" % json.dumps(p)[:600])
    out_dir = os.path.join(ROOT, "art")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "bg-%s.png" % variant)
    open(out, "wb").write(base64.b64decode(p["data"][0]["b64_json"]))
    print("saved %s  (%.0fs)" % (out, time.time() - t0))


if __name__ == "__main__":
    v = sys.argv[1] if len(sys.argv) > 1 else "duo"
    sz = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SIZE
    if v not in PROMPTS:
        sys.exit("variant 必须是 duo/trio/atmos，收到：%s" % v)
    gen(v, sz)
