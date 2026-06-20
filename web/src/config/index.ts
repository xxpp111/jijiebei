// web/src/config — 运行期强类型配置（单一真相源，由 web/scripts/gen-config.mjs 从 docs/*.csv 生成）。
// ★P0 骨架：仅 factors 一类样板，运行期尚未切到此处（jjbSession 仍读 web/src/data/jjdata 副本）。
//   后续 phase 逐表 cutover（commanders/mutators/maps/rules/bans），见本目录 README.md。
export * from './factors';
