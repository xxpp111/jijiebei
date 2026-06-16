# Phase 0 Reviewer 对账基线（hub 核验用）

源：实读 `assets/Script/jijie2/JijieContro.ts` toStart(L35)/toSelect(L113) + `assets/Script/jjbDesign/JJBData.ts` manualSlots(L96)，2026-06-16。
用途：spoke（jjb-react-phase0-modes）回报 9 模式恒等式表时，hub 逐行核验复刻忠实度，非临时翻代码。

## 恒等式真相（虚惊澄清，勿再误判）

- **`"随机因子数7/10/13"` 是 paramMap 的 key 名（标签），真实 value = 5/7/9**，正好 = ΣmanualSlots。
  恒等式 `randomFactorPoor.length === manualSlots(0)+manualSlots(1)+manualSlots(2)` **真实成立**。
- 标准8: 池5 = 1+2+2；标准10: 池7 = 2+2+3；标准12: 池9 = 3+3+3。
- 极难: factorCount=paramMap["随机因子数极难"]，先从 [风暴英雄,虚空裂隙,给我死吧,虚空重生者] 6选2 push 2 个，再 `factorCount-=2`，主循环 push 余下 → 总 push = 极难 value。
- 非酋: 忽略 factorCount，randomFactorPoor 直接 push 固定 3 个 → Σ1/1/1=3。
- 随机: factorCount=0，randomFactorPoor 空 → Σ0/0/0=0。
- 0.3 概率 popFactor("同化体")/smallRate 只消耗母池，**不改 randomFactorPoor 长度**，不影响恒等式。

## 9 模式真实分支表

| mode | handler | mfc | flag | 提前toSelect | 指挥官池 | toStart 锁定因子 | randomFactorPoor |
|---|---|---|---|---|---|---|---|
| 标准8 | onClick2 | 2 | — | 否 | A4随机+自选,B2 | getJijieFactor(false)×3 | 主循环 value(5) |
| 标准10 | onClick3 | 3 | — | 否 | A4+自选,B2 | ×3 | value(7) |
| 标准12 | onClick13 | 4 | — | 否 | A4+自选,B2 | i==2用 getJijieFactor(false,0) | value(9) |
| 拯救 | onClick4 | 3 | modeIsZhengjiu | 是(L55) | 固定7人A(雷诺/凯瑞甘/阿塔尼斯/斯旺/沃拉尊/斯图科夫/米拉) | ×3 | value(7)；toSelect 额外 pop 风暴/裂隙/0.3同化 |
| 单指A | onClickOneA | 3 | modeIsOnePick | 是(handler内) | 三场"自选" | ×3 | value-1(onePick factorCount--) |
| 极难① | onClickHard | 2 | modeIsVeryHard | 是(L50) | **整组A+整组B**(不随机抽) | getJijieFactor(**true**)×3 | 6选2+主循环=极难value |
| 极难② | onClickHard2 | 2 | modeIsVeryHard+VeryHard2 | 是(L50) | A**6**/B**3** 随机 | getJijieFactor(true)×3 | 极难value |
| 非酋 | onClickFeiqiu | 1 | modeFeiqiu | 是(handler内) | A去雷诺/B去斯台特曼 后随机,**不push自选** | **"混乱工作室"**×3 | 固定[风暴英雄,虚空裂隙,礼尚往来] |
| 随机 | onClickSuiji | 0 | modeSuiji | 是(handler内) | A4/B2,countC=4(C注释掉),**不push自选** | getJijieFactor(false)×3(抽但 sessionMatches 不显示) | 空(factorCount=0) |

## spoke 回报必查的易错点

1. **getJijieFactor 第一参**：极难①②的 toStart 锁定因子要传 `JijieData.modeIsVeryHard`(=true)；现状 toStartCore 写死 `false` 仅标准模式正确，扩展极难时必须传 true。
2. **非酋三连**：lock="混乱工作室"（非 getJijieFactor）；因子池=固定 `[风暴英雄,虚空裂隙,礼尚往来]`（忽略 factorCount）；A 删雷诺、B 删斯台特曼；`!suiji && !feiqiu` 才 push 自选 → 非酋**不**push 自选。
3. **极难①指挥官**：`modeIsVeryHard && !modeIsVeryHard2` → A=整组 `commadnerGroupList["A"]`、B=整组（**不**随机抽 4/2）；极难②(vh2) → countA=6/countB=3 随机。
4. **极难因子 6选2**：从 `[风暴英雄,虚空裂隙,给我死吧,虚空重生者]` pop 2 进池，再 factorCount-=2。
5. **拯救**：mfc=3，指挥官固定 7 人 push 到 A（顺序见表），toSelect 额外 pop 风暴/裂隙/0.3同化。
6. **单指A**：三场指挥官="自选"（不进 randomCommanderPoor）；`modeIsOnePick → factorCount--`；manualSlots 场3 `f=3`（L104）。
7. **随机模式**：factorCount=0、manualSlots 全 0、sessionMatches lock 不显示(L133)；但 toStart **仍抽 3 个锁定因子** getJijieFactor(false)（只是不显示）。
8. **调用顺序**：极难/拯救在 toStart **中途**（L50/L55）提前调 toSelect()，之后 toStart 继续 pop 地图+锁定因子 → ConfigData 母池消耗顺序=toSelect因子池→toStart锁定因子。恒等式数值不依赖顺序，但忠实复刻要保留。
9. **done-when#4 措辞陷阱**：契约 context 写"随机因子数 标准7/10/13"是 key 名；spoke 实际断言用 value 5/7/9。若 spoke 把字面 7/10/13 当因子数断言 → 会 FAIL，应核对它读的是真实 paramMap value。

## 验收门

- deterministic verify（e2e 9 模式恒等式）必须真绿——这是主门，不依赖 LLM review。
- review 若 Dubhe(127.0.0.1:8686) 不可达 → bootstrap_pass 可接受，但须如实标注，不得伪造 native PASS。
- 红线零改：jijie2/Scene/design/resources。jjbDesign(manualSlots) 若被改动 → 重点查是否破坏 battle/obs。
