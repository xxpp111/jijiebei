# 集结杯后台管理 Arco 子应用 派发契约

> **执行位**：Claude Code（GLM-5.2 经 Dubhe，或 Claude 原生）。**纯文本禁图**（遇图忽略，API 400 → STOP）。
> **本文件即 `/goal` 全文**：spoke 第一个工具调用 Read 本文件 + `docs/backend-admin-ia.md`（IA 真相），读全再开工；读不到 STOP。
> **harness-pro round** planned_phases=4。

<!-- dispatch_contract:v1 target=claude-session entry=goal harness=on planned_phases=4 -->

<objective>
  建集结杯后台管理 Arco 子应用（admin/）：主播/裁判操作台，5 模块（对局/选手/积分天梯/日志/账号）+ 登录，接 P5 PocketBase /api。
  独立 Arco Design B 端子应用，与展示层 web/(SC2 三皮肤)物理隔离。信息架构见 docs/backend-admin-ia.md（模块/功能/Arco 组件/数据接口全在内）。
</objective>

<scope>
  可以动（新增 admin/ 子应用）：
  - admin/：Vite + React + @arco-design/web-react，独立 entry（独立 package.json/vite.config/tsconfig）
  - 5 模块页（对局/选手/积分天梯/日志/账号）+ 登录 + Layout（Arco Menu 侧导航 + 顶栏 + 内容区）+ role 路由守卫
  - admin/src/api 对接层（复用 web/src/logic/backend.ts 的 fetch 模式：auth token 内存 + /api 封装）
  - admin/ 自己的 vite proxy /api→8090（dev）+ admin e2e
  - deploy：admin build → nginx location /admin 段（加进 backend/deploy/nginx-api.conf 或 admin/deploy/）

  只读参考（读懂不改）：
  - docs/backend-admin-ia.md（IA 真相 — 模块/功能/Arco 组件/权限/数据接口）
  - web/src/logic/backend.ts（对接模式：pbAuth/postMatch/getPlayers/getRankings）
  - backend/README.md + backend/pb_migrations/*.go（P5 schema/权限矩阵/api，已 hub 亲验通）

  不要动（红线零 diff）：
  - assets/Script、assets/resources、design/、web/src/logic/legacy/
  - web/ 展示层任何代码（后台是独立 admin/，零碰展示层与三皮肤 token）
  - backend/（P5 已完成，后台只读对接 /api，不改后端）
  - 不自行 git commit/push；密钥仅临时 env、不落盘
</scope>

<validation>
  done-when：
  - admin/ 起跑（cd admin && npm i && npm run dev），5 模块 + 登录 + 布局可访问，Arco 主题正常
  - 接 P5 /api 实测（需后端 8090 跑 + verify-all.sh 造数据）：登录(host/admin) → 对局列表 / 选手 CRUD / 天梯榜 / 日志(admin only) / 账号(admin) 真实 fetch P5 数据并渲染
  - role 守卫：viewer 只读 / host 限对局·选手 / admin 全部+账号·改分
  - admin 调分（admin POST scores）→ 天梯更新 + 日志审计条
  - build0（admin vite build）+ tsc0 + admin e2e（关键模块渲染 + fetch P5 真数据断言）
  - deploy：nginx location /admin 段 + admin runbook（与 web/ 展示 + /api 后端三者同 nginx 共存）

  proof（spoke 真跑贴回）：
  <pre lang="bash">
  cd /Users/bytedance/项目/jijiebei/backend && ./pocketbase serve --http 127.0.0.1:8090 --dir pb_data &  # 起 P5
  bash verify-all.sh >/dev/null 2>&1  # 造数据（admin/host/viewer/players）
  cd ../admin && npm i && npm run build 2>&1 | tail -3  # admin 编译
  node e2e/<admin-e2e>.mjs  # 登录+各模块 fetch P5 断言
  </pre>
  【六硬约束】①不跳phase②review/gate/audit只CLI驱动③frozen/runtime只读④禁伪造PASS⑤证据引pre-review⑥不确定/失败→停
</validation>

<stop_when>
  - 需改 web/ 展示层 / backend/ / assets/legacy/design → STOP（后台是独立 admin/）
  - 本契约文件 / docs/backend-admin-ia.md 读不到 → STOP
  - 收到图片/截图输入 → 纯文本继续；API 报 content type/400 → 立即 STOP（上轮崩 session 根因）
  - P5 后端 schema/api 与 IA 假设冲突 → STOP 交 hub（P5 是只读依赖，不改后端）
  - harness phase gate BLOCKED 且非假阳性 → STOP 交 hub
  max_iterations: 35
  max_duration: 5h
</stop_when>

<context>
  必须先读：
  - docs/backend-admin-ia.md（IA：5 模块 + 布局 + 权限 + Arco 组件 + 数据接口表）
  - web/src/logic/backend.ts（fetch /api 对接模式，admin 复用此模式）
  - backend/README.md（P5 schema↔live 映射 + api 列表 + 权限矩阵）
  已定真相（不重论证）：
  - 后台用 Arco（@arco-design/web-react），独立 admin/ 子应用，不碰 web/ 三皮肤
  - 接 P5 /api（同源；dev vite proxy /api→8090，生产 nginx /admin + /api）
  - P5 后端已 hub 亲验通（权限矩阵/hook/天梯/sqlite），后台只读对接不改
  - 账号 admin 建（不开放注册，对齐 migration2 锁 users）
</context>

<motivation>
  后台管理是比赛平台的运营地基——主播/裁判管选手、改积分、查对局、审日志。与展示层(选手/观众 SC2 游戏风)受众不同，用 Arco B 端组件追求操作效率。P5 后端 schema/权限已为此设计(role 矩阵/审计 hook)，后台是其自然消费端。
</motivation>

<persistence>Keep going until fully resolved. 服从 stop_when 优先。纯文本不碰图片。</persistence>

---

## Harness-Pro Round 配方（planned_phases=4）
写 repo/产 runtime → harness round。起跑前 invoke harness-pro skill + 读 adapter，doctor + (Dubhe)live probe reviewer alias(与执行底座 disjoint)。init 后每条 CLI 显式 --runtime-dir，review 显式 --model-config。
**4 phase**：① admin/ 脚手架(Vite+React+Arco+Layout+路由+登录) ② 对局/选手模块(Table/Form/CRUD 接 P5) ③ 积分天梯/日志/账号模块(admin 权限+调分+审计) ④ role 守卫全覆盖+admin e2e+deploy(nginx /admin+runbook)。
确定性验证(admin build0 + 接 P5 真数据 fetch + role 矩阵 + e2e)才是真 gate，reviewer advisory。

## Arco 注意
- `npm i @arco-design/web-react`；按需引入 + Arco 主题 CSS。
- 中文 locale（ConfigProvider zh-CN）。
- Table/Form/Menu/Modal/Drawer/Descriptions/Message 为主；表单校验用 Arco Form rules。
- dev proxy 在 admin/vite.config.ts（独立于 web/）。
