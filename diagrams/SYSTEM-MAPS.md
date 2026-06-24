# 集结杯 · 体系运作图（SYSTEM MAPS）

> repo 内 Mermaid 版（进 git、可 diff、随代码演进）。团队可读版在飞书 KB 画板。
> 三张图回答三个问题：**这套系统由什么组成 / 一局比赛怎么流动 / 我们怎么开发它**。
> 维护：架构/流程变更时同步改本文件 + 飞书画板。最后更新 2026-06-24。

---

## 图 1 · 系统架构（系统由什么组成）

```mermaid
flowchart TB
  subgraph U["👥 用户"]
    主播["主播<br/>土豆 / 歪比 / 老王 / 莽咕"]
    观众["观众 / 导播"]
    选手["参赛选手"]
  end

  CF["🌐 cloudflared 隧道<br/>touched-cover-stats-humanity.trycloudflare.com"]

  subgraph DEV["🖥 devbox 10.37.220.128 · nginx:8080 三层同源"]
    web["web 展示层 · React+Vite+三皮肤<br/>home·select·battle·result·obs·ladder·login"]
    admin["admin 后台 · Arco<br/>对局·选手·排名·日志·账号"]
    api["location /api → 127.0.0.1:8090"]
  end

  subgraph BE["⚙️ PocketBase 后端 (Go embed)"]
    集合["5 集合<br/>accounts(主播) · players(选手)<br/>matches(对局) · scores(积分) · logs(审计)"]
    hook["Go hook<br/>match 落库 → 派生 scores<br/>(mode=match 算分, practice 跳过)"]
    rank["/api/rankings 天梯聚合 SUM(delta)<br/>/api/scoring 11 模式系数"]
  end

  主播 --> CF
  观众 --> CF
  选手 --> CF
  CF --> web
  CF --> admin
  web --> api
  admin --> api
  api --> 集合
  集合 --> hook
  hook --> rank
  rank --> web
```

---

## 图 2 · 比赛流程（一局怎么流动 · 标出哪通哪断）

```mermaid
flowchart LR
  登录["🔑 主播登录<br/>pbAuth→host token"]
  home["🏠 home 比赛tab<br/>输选手 ID"]
  select["🎲 select<br/>选因子/指挥官/随机填充"]
  battle["⚔️ battle<br/>判定 3 场<br/>胜 / 带奖励 / 败"]
  result["🏁 result 结算<br/>大比分 + 自动落库"]
  match["📥 matches 落库<br/>game_mode + result"]
  scores["💰 scores 派生<br/>delta = 胜场 × 系数"]
  ladder["🏆 ladder 天梯<br/>SUM 排名 + 段位"]

  登录 -->|✅| home -->|✅| select -->|✅| battle -->|✅| result -->|✅| match
  match -->|❌ 断| scores -->|❌ 断| ladder

  断点["⚠️ 根因: 公网 players 表空<br/>选手 ID 关联失败 → match.players=[]<br/>→ scoreMatch 循环零次 → 不派生 scores"]
  match -.->|断在这| 断点
  修复["🔧 T2 jjb-ladderfix spoke<br/>nickname 兜底放宽 (修复中)"]
  断点 -.->|修| 修复
  修复 -.->|修通后| ladder

  classDef ok fill:#1f6f3f,stroke:#2ecc71,color:#fff
  classDef bad fill:#7a2f25,stroke:#e0a93e,color:#fff
  class 登录,home,select,battle,result,match ok
  class scores,ladder,断点 bad
```

> 单刷/双打 UI 全流程 works，单刷能落一条真 match；**天梯恒空是头号产品阻塞**（非 UI bug，是 players 表空的数据断点），T2 spoke 用 nickname 兜底修复中。双打「两主播同步判定合流」架构上不存在，是 T8 探测对象。

---

## 图 3 · 开发体系（我们怎么开发它 · hub→spoke 编排）

```mermaid
flowchart TB
  yb["👤 yb 拍板<br/>需求 / 决策 / 验收"]
  hub["🧠 hub · Claude Code<br/>规划 · 派发 · 监控 · 终验 · 收口"]
  yb --> hub

  subgraph SPOKE["🔧 spoke 执行位 (按任务性质路由)"]
    s1["Claude session<br/>质量敏感 / 产品判断"]
    s2["GLM-5.2 + CC<br/>机械 / harness round"]
    s3["MiniMax M3 + CC<br/>批量 / 文档"]
    s4["GPT-5.5 + Codex<br/>强推理 / 后端"]
    s5["Claude Design<br/>UI 设计稿"]
  end
  hub -->|copy-paste 派发<br/>契约四段+marker| SPOKE
  hub -->|opt-in| wf["⚡ Workflow<br/>多 agent 并行梳理/审计"]

  round["🔄 harness-pro round<br/>init → phase → verify → review → gate → audit"]
  panel["🧑‍⚖️ reviewer panel<br/>Dubhe 多模型 · 与执行模型 disjoint"]
  SPOKE -->|每个写代码任务| round
  round --> panel
  panel --> gate{"gate PASS?"}
  gate -->|是 + spoke 留档| hub
  hub -->|hub 亲验 留档≠真相| commit["📦 commit / push"]

  subgraph TEST["🧪 三层测试体系 (建设中)"]
    t1["① 代码层<br/>vitest + go test + drift + npm test"]
    t2["② AI-E2E<br/>Playwright skill 化 flows"]
    t3["③ 双打同步<br/>两 profile + 时间差"]
  end
  commit --> TEST
  TEST -->|回归网兜住| hub

  classDef hubcls fill:#3a2f5a,stroke:#8b7fb8,color:#fff
  classDef testcls fill:#1f4f5a,stroke:#3fb8c8,color:#fff
  class hub hubcls
  class t1,t2,t3 testcls
```

> **当前在建**：三层测试体系（T1 GLM-5.2 起跑中）。**当前并行 lane**：T1 测试(GLM-5.2) · T2 修天梯(Claude) · T3 文档(MiniMax) · T4 本图(hub)。
