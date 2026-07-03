# admin/ Arco 后台 runbook

> 集结杯后台管理子应用（主播/裁判操作台）。独立 Vite+React+Arco，与展示层 `web/` 物理隔离，接 P5 PocketBase `/api`。

## 起跑（本地开发）

```bash
# 1. 起 P5 后端（前置，见 backend/README.md）
cd /Users/bytedance/项目/jijiebei/backend
./pocketbase serve --http 127.0.0.1:8090 --dir pb_data &
bash verify-all.sh   # 造测试数据（admin/host/viewer + players）

# 2. 起 admin dev（vite proxy /api → 8090）
cd ../admin
npm install
npm run dev          # http://127.0.0.1:7790/admin/
```

登录测试账号（verify-all.sh 造）：
- admin@jjb.test / Admin123456! （全部模块 + 账号 + 调分）
- host@jjb.test / Host123456! （对局/选手/积分，无账号/日志）
- viewer@jjb.test / Viewer123456! （只读）

## 编译验证

```bash
cd admin
npm run tsc          # tsc --noEmit（exit 0）
npm run build        # vite build → admin/dist（base=/admin/）
node e2e/admin-smoke.mjs   # e2e：登录 + 各模块 fetch P5 真数据 + role 守卫 + admin 调分
```

e2e 前置：P5 在 8090 跑 + verify-all.sh 已造数据。

## 部署（devbox nginx 共存）

admin/dist 与 web/dist + /api 后端三者同 nginx :8080 共存：

```nginx
# 加进 server 块（与 nginx-api.conf 的 location /api/ 并列）
location /          { root /opt/jjb/web/dist;  try_files $uri /index.html; }   # 展示层（现状不变）
location /admin/    { alias /opt/jjb/admin/dist/; try_files $uri /admin/index.html; }  # 后台（见 nginx-admin.conf）
location /api/      { proxy_pass http://127.0.0.1:8090; ... }   # 后端（见 nginx-api.conf）
```

部署步骤：
```bash
# devbox 上
cd /opt/jjb/admin && npm ci && npm run build    # 产物 admin/dist
# nginx reload（把 nginx-admin.conf 片段并入 server 块后）
sudo nginx -t && sudo nginx -s reload
```

## 模块与权限

| 模块 | 路径 | viewer | host | admin |
|---|---|---|---|---|
| 对局 | /admin/matches | 只读 | 读 + admin 删 | 全部 |
| 选手 | /admin/players | 只读 | CRUD（admin 删） | CRUD |
| 积分天梯 | /admin/rankings | 只读榜单 | 只读榜单 | 榜单 + 手动调分 + 调分记录 |
| 日志 | /admin/logs | 不可见 | 不可见 | 只读 |
| 账号 | /admin/accounts | 不可见 | 不可见 | CRUD + 改 role |

role 守卫双层：菜单按 role 过滤（AdminLayout）+ 路由 RoleRoute 兜底（防直接访问 URL）。

## 红线

- 不动 `web/`（展示层 SC2 三皮肤）、`backend/`（P5 只读对接）、`assets/Script`、`design/`、`legacy/`。
- admin/ 是新增独立子应用，与展示层物理隔离（独立 package.json/vite.config/tsconfig）。
- token 仅内存（api/client.ts），不落盘。

## caveat

1. **payload_code 还原**：对局详情「贴码还原」按钮跳展示层 `/#<payload_code>`，依赖展示层支持 URL hash 还原码（P3 codec 入口）；若展示层还原协议不同，按实际调整。
2. **avatar 上传**：选手 CRUD 暂未含头像文件上传（PocketBase FileField 需 multipart），前端用族徽占位；如需头像，后续加 file upload。
3. **公网暴露**：devbox nginx /admin 同 /api 一样只内网；公网暴露须 SRE 走 TLB（内网穿透红线）。
