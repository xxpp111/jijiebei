---
name: jjb-verify
description: 集结杯验证基建：四套 Playwright 回归、断言纪律、Cocos 截图与交互技术、__jjbDebug 契约、Cocos 2.4 坑库。改 jjbDesign 代码、写断言、做截图验证时使用。
---

# 集结杯验证手册

## 回归套件（全部要求 console errors=0）

```bash
# 前置：build 最新 + 本地服务 7777 在跑（见 jjb-run-broadcast）
node /tmp/jjb-test/phaseG.js      # 48 条：DEMO fallback/live 全模式/doubles 自洽/Label 可见性
node /tmp/jjb-test/obsbar.js      # 42 条：横条结构/五态/单源同步/bare/bartop/doubles
node /tmp/jjb-test/all.js         # 36 条：8/10/12/拯救/随机/抽签/二选层/选手名 全玩法
node /tmp/jjb-test/v4-existing.js # 20 条：v4 边框/控制条/行级态
# helpers.js = 节点查找/emit 点击/拖拽/EditBox 注入公共库
```

/tmp 易失：套件丢失时按 projectplan「批3 B6」「Phase D-fix/G」记录重建。汇总 JSON 落盘 `/tmp/jjb-v4-impl/playwright-summary-phaseX.json`。

## 断言纪律（事故教训固化）

1. 几何期望值从 `cc.view.getVisibleSize()`/世界包围盒实测推导，**禁 magic number**（事故：-360 是按坏实现反推的）。
2. **禁断自报常量**：exposeDebug 字段必须是实测（遍历子节点包围盒），断言不许断"代码里写死的 true"。
3. 文字可见性通检：遍历 Label，字符串非空 ⇒ 节点宽>0。
4. 全页校验不许裁切；多视口（1280×232/1600×300/800×400）+ 明暗主题都要覆盖。
5. 真实点击有 touch+mouse 双触发（同帧两次回调），测试 emit 单发不会复现——副作用类逻辑要做同帧重入防御（参照幽灵控制条修复）。

## Cocos 页面驱动技术

- **点击**：`node.emit(cc.Node.EventType.MOUSE_UP)`（JJBView.hit 监听 MOUSE_UP）；节点名约定 `jjbV_场_值`（判定）、`jjbCtrl_*`（控制条）、`jjbCtrlPill`、`jjbMode_i`、`jjbStart`。
- **截图**：Playwright `page.screenshot` 对 Cocos WebGL 会等稳定帧超时 → 用 CDP `Page.captureScreenshot`。必须等资源加载完（sprite 异步 load）+ ~350ms 再拍。
- **防缓存**：URL 加 `?cb=<随机>`——旧 index.html 引用过期 hash 会 404 崩启动，用户侧表现为"看到旧版"。
- **__jjbDebug 契约**：`screen`（当前屏）、`select`（live/slots/poolIdentity/error）、`battle`（winLoseList/winCount/totalCount）、`obsbar`（score/statuses/heroIndex/懒计算世界坐标 barTopY/barBottomY/viewportTopY 等，读取时强制重算）、`control`（canXxx 门控）、`doubles`。

## Cocos 2.4 坑库（每条都付过学费）

1. **一节点一渲染组件**：Graphics 和 Label 不能同节点；多层描边 = 每层一个子节点。
2. **Label 挂载吃尺寸**：addComponent(cc.Label) 瞬间按空串实测把节点改 0 宽，CLAMP 下文字整裁 → 配置完必须重设 `setContentSize(w,h)`（JJBView.label/JJBObsBar.label/JJBBorder.localLabel 均已修）。
3. **destroy 帧末延迟** + getChildByName 只取第一个 → 同帧重建会漏删累积幽灵节点 → 清理要遍历全部同名子节点。
4. **坐标系**：JJBView.placed 输入 top-down 设计坐标、内部换算中心原点，HALF 取自 `getDesignResolutionSize()`（bare 模式 232 高）→ 禁止用裸 `-top` 覆盖节点 y（事故：横条整条掉出画布）。
5. **tween y 捕获**行为有差异 → 入场动画用 opacity 淡入，不 tween 位置。
6. **位图放大必糊**：71px 素材在 Retina ×2 即放大采样 → 装饰元素一律 Graphics 矢量（u=size/66 系数体系见 design/v4-r2/fx-vector.css）。
7. **EditBox** 编辑器外创建：textLabel/placeholderLabel 要手工建并指派，否则失焦文字不可见。
8. `cc.isValid(n, true)` strict 模式才过滤同帧 destroy 的节点。
9. saturate 滤镜无内建 → 降饱和用透明度/叠暗色近似并注释取舍。
