# -*- coding: utf-8 -*-
import csv, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "assets", "resources", "data", "factors.txt")
OUTDIR = HERE  # 与脚本同目录（docs/）
os.makedirs(OUTDIR, exist_ok=True)

# 官方因子点数（灰机 live 核对，52 标准因子）
PTS_GROUPS = {
 1:"震荡攻击 强行征用 闪避机动 生命吸取 轨道轰炸 光子过载 短视症 时空力场 时间扭曲",
 2:"异形寄生 减伤屏障 暗无天日 坚强意志 鼓舞人心 激光钻机 超远视距 晶矿护盾 默哀 净化光束 焦土政策 速度狂魔 龙卷风暴 行尸走肉",
 3:"进攻部署 伤害散射 双重压力 致命勾引 无边恐惧 核弹打击 岩浆爆发 飞弹大战 丧尸大战 自毁程序 来去无踪",
 4:"暴风雪 强磁雷场",
 5:"复仇战士 拿钱说话 相互摧毁 灵能爆表 小捞油水 虚空重生者",
 6:"杀戮机器人 扫雷专家",
 7:"黑死病 给我死吧 极性不定 力量蜕变",
 8:"同化体",
 10:"炸弹机器人 风暴英雄 虚空裂隙",
}
LIMITED = set("惧怕黑暗 混乱工作室 焰火秀 礼尚往来 幸运红包 杀生业报 补给共享 不给糖果就捣蛋 捕杀火鸡 迷失方向".split())
UNIMPL  = set("极度谨慎 刺头兵 上班偷睡 消极战斗 石像狂热者 不死邪魔".split())

def norm(s): return s.strip().strip("！!　 ").strip()
PTS = {}
for p, names in PTS_GROUPS.items():
    for n in names.split(): PTS[norm(n)] = p
# factors.txt 里的拼写 typo -> 官方名（点数同源），用于干净评分；上游应修正
ALIAS = {"时空立场":"时空力场", "生命汲取":"生命吸取", "龙卷风":"龙卷风暴"}
for typo, real in ALIAS.items(): PTS[typo] = PTS[real]

def band(total, flag):
    if flag: return flag
    if total < 4: return "太易(<残酷+1)"
    if total <= 8: return "A(易·残酷+1~2)"
    if total <= 12: return "B(中·残酷+3~4)"
    if total <= 14: return "B/C边界"
    if total <= 20: return "C(难·残酷+5~6)"
    return "超C(>20)"

rows = []
with open(SRC, encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i == 0: continue
        cells = [c.strip() for c in line.rstrip("\n").split("\t")]
        if len(cells) < 2 or not cells[0].isdigit(): continue
        mid = int(cells[0]); name = cells[1]; mp = cells[2] if len(cells) > 2 else ""
        toks = [norm(c) for c in cells[3:] if norm(c)]
        facs, unrec, total, flag = [], [], 0, ""
        for t in toks:
            if t in PTS: facs.append((t, PTS[t])); total += PTS[t]
            elif t in LIMITED: facs.append((t, "限定")); flag = "含限定·不可用"
            elif t in UNIMPL:  facs.append((t, "未实装")); flag = "含未实装·不可用"
            elif t.isdigit() or any(ch.isdigit() for ch in t): pass  # 点数/星级列
            else: unrec.append(t)
        if unrec and not flag: flag = "含自制/未知因子·需人工"
        rows.append(dict(id=mid, name=name, map=mp,
                         facs=facs, unrec=unrec, total=total,
                         band=band(total, flag),
                         pool=("官突池(id<200)" if mid < 200 else "挑战池(id>=200)")))

def report(pool_rows, title):
    print(f"\n===== {title}  共 {len(pool_rows)} 条 =====")
    bc = collections.Counter(r["band"] for r in pool_rows)
    for b in ["太易(<残酷+1)","A(易·残酷+1~2)","B(中·残酷+3~4)","B/C边界","C(难·残酷+5~6)","超C(>20)",
              "含限定·不可用","含未实装·不可用","含自制/未知因子·需人工"]:
        if bc.get(b): print(f"  {b:22s}: {bc[b]}")
    scored = [r for r in pool_rows if not r["unrec"] and "不可用" not in r["band"]]
    hist = collections.Counter(r["total"] for r in scored)
    print("  点数和分布:", " ".join(f"{k}:{hist[k]}" for k in sorted(hist)))
    if scored:
        tot=[r["total"] for r in scored]
        print(f"  点数和 min/mean/max = {min(tot)}/{sum(tot)/len(tot):.1f}/{max(tot)}")

report([r for r in rows if r["pool"].startswith("官突池")], "官突池 id<200")
report([r for r in rows if r["pool"].startswith("挑战池")], "挑战池 id>=200")

# 官突池里"含限定因子·不可用"的突变（官方不进自定义，需排除）
bad = [r for r in rows if r["pool"].startswith("官突池") and "限定" in r["band"]]
print("\n官突池·含限定因子不可用的突变:")
for r in bad:
    print(f"  #{r['id']} {r['name']} = " + " + ".join(f"{n}({p})" for n,p in r["facs"]))

# 未识别因子汇总（排查命名不一致 / 自制因子）
unrec_all = collections.Counter()
for r in rows:
    for t in r["unrec"]: unrec_all[t]+=1
print("\n未识别因子 token（出现次数，前 40）:")
print("  " + "  ".join(f"{t}×{c}" for t,c in unrec_all.most_common(40)) if unrec_all else "  （无）")

# 写 CSV 配置表
def write_csv(path, pool_rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["序号","突变名称","地图","因子(点数)","点数和","初筛档","标记/备注"])
        for r in sorted(pool_rows, key=lambda x:(x["band"], -x["total"])):
            facs = " + ".join(f"{n}({p})" for n,p in r["facs"])
            note = ("未识别:"+",".join(r["unrec"])) if r["unrec"] else ""
            w.writerow([r["id"], r["name"], r["map"], facs, r["total"], r["band"], note])

write_csv(f"{OUTDIR}/官突ABC配置_官突池.csv", [r for r in rows if r["pool"].startswith("官突池")])
write_csv(f"{OUTDIR}/官突ABC配置_挑战池.csv", [r for r in rows if r["pool"].startswith("挑战池")])

# 因子点数配置表（底层）
with open(f"{OUTDIR}/因子点数配置.csv","w",encoding="utf-8-sig",newline="") as f:
    w=csv.writer(f); w.writerow(["因子","点数","可用于自定义","单刷ban","双打ban","备注"])
    danshua_ban=set("极性不定 拿钱说话 杀戮机器人 小捞油水 致命勾引".split())
    shuangda_ban=set("拿钱说话".split())
    for n,p in sorted(PTS.items(), key=lambda x:(x[1],x[0])):
        w.writerow([n,p,"是","是" if n in danshua_ban else "","是" if n in shuangda_ban else "",""])
    for n in sorted(LIMITED): w.writerow([n,"限定","否","","","限定因子,官方不进自定义/残酷+"])
    for n in sorted(UNIMPL):  w.writerow([n,"未实装","否","","","仅编辑器,任何模式都没有"])

print(f"\n已写出 CSV 到 {OUTDIR}/")
print("  官突ABC配置_官突池.csv / 官突ABC配置_挑战池.csv / 因子点数配置.csv")
