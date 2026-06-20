# legacy/ — XP(Cocos) 旧线逻辑的 web 运行期副本（DEPRECATED 源，只读致敬）

这三个文件是从 `assets/Script/jijie2` / `assets/Script/jjbDesign` **只读复制**而来的 web 运行期真身。
原件是 XP 在 Cocos 线上的知识成果，**原封保留、不维护、不篡改**（见 `projectplan.md`「★Cocos 尊重原则」）。
P0 架构清场后，React 线不再经 vite alias 跨界 import 原件，改 import 本目录副本，使 `web/` 自包含。

| 副本 | 源（XP 原件，只读保留） | web 适配偏离 |
|---|---|---|
| `JijieData.ts` | `assets/Script/jijie2/JijieData.ts` | 无（逐字复制，纯静态状态容器） |
| `JJConfigData.ts` | `assets/Script/jijie2/data/JJConfigData.ts` | 断 GameData 死链：删 `import GameData` 与唯一消费者 `calcCurrentScore()`（web/src 零引用）。抽签引擎逻辑逐字保留 |
| `JJBData.ts` | `assets/Script/jjbDesign/JJBData.ts` | 内部 import `../jijie2/JijieData` → `./JijieData`（同目录副本）。逻辑逐字保留 |

> 原件仍在 `assets/Script/`，是 Cocos 线唯一真相；本副本是 React 线的运行期真身。两者已分叉演进——
> **改 web 行为只动本目录副本，绝不回改 `assets/Script/` 原件。**
