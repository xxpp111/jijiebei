# 集结杯积分系数表方案（待 yb / 土豆 定稿）

> 现状：`backend/config/scoring.json` 是占位，公式 `delta = wins × coefficient[game_mode]`，纯累加（非 Elo）。
> 定稿后 hub 接：① scoring.json 系数（改 json 重启生效）② LadderScreen `tierOf` 段位阈值 ③ routes.go 分榜 board 集合。

## 待定 1 · 单刷 / 双打分类（分榜用）

当前默认（已实现，注释标 TODO）：

| 榜 | game_mode 集合 |
|---|---|
| 单刷 | `std8` `std10` `std12` `rescue`（+ 其余非双打 NOT IN） |
| 双打 | `doubles`（官突） `feiqiu-doubles`（非酋之轮） |
| 总榜 | 全部 |

**待你确认**：`one-a` / `hard1` / `hard2` / `feiqiu`(单刷飞球) / `suiji` 当前 HomeScreen 不可启动（codec 合法但进不了对局），将来若开放归哪个榜？

## 待定 2 · 双打按队还是按个人

- **当前**：`scores` 是 per-player（双打一局 2 个 player 各得一条 score）→ **双打个人榜天然成立**（每人各算各的）。
- **待定**：要不要额外的「双打组合榜」（按 2 人战队累计）？→ 需加 `matches.team` 字段或组合 key，是 schema 改动，定了我做。

## 待定 3 · 系数建议（难度加权，供讨论的起点）

| 模式 | 建议系数 | 理由 |
|---|---|---|
| std8 | 1.0 | 标准基准 |
| std10 | 1.1 | 因子多 2 |
| std12 | 1.2 | 因子多 4 |
| rescue | 1.3 | 固定 7 人、难度高 |
| hard1 / hard2 | 1.3 | 极难 |
| doubles / feiqiu-doubles | 1.0（待定是否加权）| 双打基准 |

**段位阈值**（LadderScreen 现用占位，待按真实分赛季后的分布校）：王者 1200 / 钻石 900 / 铂金 750 / 黄金 600 / <600 新锐。

## 你们定稿后给我 3 个数
1. 各模式系数（覆盖 scoring.json）
2. 单刷/双打集合（含 one-a 等是否开放）
3. 段位阈值（或让我按首赛季真实分布算）

→ 我一次接好后端系数 + 分榜集合 + 前端段位阈值。
