// doubles-match.flow.mjs — 双打比赛流程 + 引擎参数验证（官突/非酋）。
// 落库链路见 A（host token POST 双打 match → hook 派生 scores → double 榜，curl 已验通；前端 maybePostMatch mode-agnostic 比赛 tab 进双打即落库）。
// 此 flow 聚焦双打 select 引擎参数（双打 battle 复用 BattleScreen 分流，判定 UI 选择器脆，落库另由 A 保证）。需 P5 可选（纯引擎参数不依赖后端）。
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  // 6 号位 官突双打 → facPool=9 抽 CSV 真表
  await page.goto(`${baseUrl}/?screen=home&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await (await page.$('[data-home-tab="match"]'))?.click(); await page.waitForTimeout(400);
  await page.click('[data-mode-btn="doubles"]'); await page.waitForTimeout(900);
  expect(await page.$('[data-doubles-select]'), '官突双打 select 屏渲染');
  await (await page.$('[data-doubles-random-fill-btn]'))?.click(); await page.waitForTimeout(600);
  const g = await page.evaluate(() => window.__jjbDebug?.doubles || {});
  expect(g.live === true, '双打 live');
  expect(g.config?.variant === 'guantu', `官突 variant（实=${g.config?.variant}）`);
  expect(g.factorPool?.length === 9, `官突 factorPool=9 抽 CSV 真表（实=${g.factorPool?.length}）`);
  expect(g.commanderPool?.length === 6, `6 指挥官池（实=${g.commanderPool?.length}）`);
  await shot(page, 'doubles-guantu');

  // 5 号位 非酋之轮 → facPool=3 固定可分配
  await page.goto(`${baseUrl}/?screen=home&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await (await page.$('[data-home-tab="match"]'))?.click(); await page.waitForTimeout(300);
  await page.click('[data-mode-btn="feiqiu-doubles"]'); await page.waitForTimeout(800);
  await (await page.$('[data-doubles-random-fill-btn]'))?.click(); await page.waitForTimeout(500);
  const f = await page.evaluate(() => window.__jjbDebug?.doubles || {});
  expect(f.config?.variant === 'feiqiu', `非酋 variant=feiqiu（实=${f.config?.variant}）`);
  expect(f.factorPool?.length === 3, `非酋 factorPool=3 固定可分配（实=${f.factorPool?.length}）`);
  await shot(page, 'doubles-feiqiu');
});
done('doubles-match');
