# 集结杯后台管理 信息架构（IA）— 主播/裁判操作台

> **技术栈**：独立 **Arco Design** 子应用（React+Vite，与展示层 `web/` 物理隔离、不污染 SC2 三皮肤 token；技术栈分层决策 projectplan 2026-06-22）。受众=主播/裁判内部 B 端，追求填表/改分/查日志效率。
> **数据源**：P5 PocketBase 5 集合（accounts/players/matches/scores/logs）+ `/api/rankings` + `/api/scoring`，同源 nginx `/api` 反代（dev 用 vite proxy）。
> **设计路径**：Arco 本身即 B 端设计系统（Table/Form/Menu/Modal…），**不走 Claude Design 出像素稿**（会和 Arco 组件对不上、反绕路）；本 IA = 信息架构 + 功能 + Arco 组件映射，spoke 据此直接实现。若要后台视觉概念另说。

## 布局（Arco Layout）
- **顶栏**：品牌「集结杯 · 管理后台」+ 当前赛季 + 账号(display_name/role) + 登出。
- **侧导航**（Arco Menu）：对局 / 选手 / 积分天梯 / 日志 / 账号(admin only)。
- **内容区**：Arco Table / Form / Modal / Drawer / Descriptions。
- **权限**：host 见对局·选手·积分(改分需admin)；admin 全部+账号；viewer 只读。role 路由守卫。

## 模块

### 1. 对局管理（matches）
- 列表（Table）：时间 / 模式(mode) / 赛制(game_mode) / 选手 / 比分(score_total) / host。筛选=赛季·模式·选手，分页。
- 详情（Drawer）：payload_code（"贴码还原"按钮跳展示层对照）/ result winLoseList / bp_config 快照。
- 操作：admin 可删（误录）；host 限自己主持的局（updateRule）。

### 2. 选手管理（players）
- 列表（Table）：昵称 / player_code / 种族 / 在役 / 对局数。
- CRUD（Form+Modal）：nickname / player_code(unique) / race_pref / avatar / active / notes。host·admin 可建，admin 可删。
- player_code=稳定锚（直播展示用，不可改），昵称可改。

### 3. 积分天梯（scores + rankings）
- 天梯榜（Table）：名次 / 选手 / 总积分(total_delta) / 对局数，按赛季。
- 手动调分（admin only Form）：选手 + delta + reason → POST scores；进审计。
- 调分记录（Table）：scores 列表（选手/delta/reason/match/赛季）。

### 4. 日志审计（logs，admin only）
- 只读列表（Table）：时间 / 操作者 / 动作(action) / 对象 / 详情(detail diff) / IP。筛选=动作·操作者·时间。
- 不可改不可删（后端 rule=null + 前端只读，双保险）。

### 5. 账号管理（accounts，admin only）
- 列表（Table）：邮箱 / display_name / role / verified。
- CRUD（Form）：建主播/裁判账号 + 角色(admin/host/viewer)；不开放自助注册（admin 建，对齐 migration2 锁 users）。

### 登录（后台 B 端，Arco Form）
- 邮箱+密码 → `/api/collections/accounts/auth-with-password`；role 决定可见模块。
- 与展示层登录(Brief F, SC2 风)分离——后台是 B 端 Arco 登录。

## 实现要点（spoke）
- 新建 `admin/` 子应用：Vite + React + `@arco-design/web-react`，独立 entry（不碰 `web/` 三皮肤/token）。
- 接 P5 `/api`（dev vite proxy `/api`→8090，生产 nginx）；复用 `web/src/logic/backend.ts` 的对接模式（auth token 内存 + fetch 封装）。
- 部署：`admin/` build → nginx 加 `location /admin`（或独立子域），与 `web/`(展示) + `/api`(后端) 三者同 nginx 共存。
- 红线：assets/Script/design/legacy 零改动；后台是新增 `admin/`，不动 `web/` 展示层。

## 数据接口（P5 /api，已 hub 亲验通）
| 集合/路由 | 后台用途 |
|---|---|
| accounts auth-with-password | 后台登录 |
| accounts records | admin 账号 CRUD |
| players records | 选手 CRUD |
| matches records | 对局 list/view/admin del |
| scores records | admin 调分 POST / 调分记录 list |
| logs records | admin 审计 list（只读） |
| /api/rankings | 天梯榜 |
| /api/scoring | 系数表 |
