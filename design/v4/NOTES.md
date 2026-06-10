# v4 集结杯 工作笔记（勿删）

两套工作并存：CM 公告图（项目根，见 work/NOTES.md）；集结杯 v4 = 本目录。
背景：CM 是星际2合作任务 MOD；集结杯是 CM 合作的比赛直播工具；v3 设计已落地 Cocos（6 主题×5 屏）；v4=细节修缮（brief: design/v4-input/v4-design-brief.md，本地挂载文件夹 "design"）。

## R1 已交付（选择面板）— v4/选择面板 v4.html（设计画布）
- 整屏×3：metal-dark(控制条展开+toast) / minimal-light(亮底适配) / sc2-dark(收起态)
- 规格板：CtrlStates 920×500 / FactorMatrix 830×420 / FactorSizes 830×265 / ThemeStrip 950×122(chip 158) / CmdMatrix 780×345 / CmdSizes 780×300 / ImplSpec 920×520
- 文件：v4.css（.jjbx token容器/.fx因子边框/.cc指挥官卡/.ctrl控制条/.toastv校验/.mx规格板）；select-screen.jsx（FX/CC/DropCell/CtrlBar/ToastV/SelectScreenV4→window）；spec-factor.jsx（SpecBoard/FactorMatrix/FactorSizes/ThemeStrip）；spec-cmd.jsx（CmdMatrix/CmdSizes）；spec-impl.jsx（CtrlStates/ImplSpec）
- 主CSS继承 v3：v4/theme.css + v4/styles.css（token: .style-{metal|sc2|minimal} × .mode-{dark|light}）
- 素材：v4/assets/*（cmd/factor/map/logo），v4/input/border-factor-normal.png(71×73, slice16) + border-factor-gold.png(126×126, slice26, 中心透明)
- 设计要点：因子方形位=整图缩放免九宫格；状态包边框外侧；锁定=深底金字角标/官突=实底accent角标；cc=r6外暗描边+r4内亮线+顶高光+投影；控制条顶部中央4组（导航|重抽/回主|主题|收起），危险操作就地二次确认5s还原；toast红框!图标+条数角标
- 动效：✓ pop 180ms back-out；sel浮起120ms；清除反向140ms；落定160ms+闪环240ms；toast抖动300ms/4s消失；收起220ms

## 未做（下一轮）
battle 页边框落位、浮层 OBS 底部横条（1280×200~240，缩至1/3可读）、二选层（home）正式化、（可选）双打 select 变体。

## 工具备忘
- 用户邮箱域 up.ac.th；review 辅助页 v4/_r*.html（zoom 缩放截屏用，交付后可删）
- save_screenshot 带 code 步骤在本环境报 "No preview pane available"；无 code 也偶发，重试/重新 show_html 后成功
- 截屏只截 viewport（非全文档）→ 用 body zoom 缩放审查
- design_canvas 画板需显式 width/height；.jjbx 需 button reset（已加）
