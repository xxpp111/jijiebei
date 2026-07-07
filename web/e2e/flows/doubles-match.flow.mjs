// doubles-match.flow.mjs — 双打比赛流程 + 引擎参数验证（官突/非酋）。
// 落库链路见 A（host token POST 双打 match → hook 派生 scores → double 榜，curl 已验通；前端 maybePostMatch mode-agnostic 比赛 tab 进双打即落库）。
// 此 flow 聚焦双打 select 引擎参数（双打 battle 复用 BattleScreen 分流，判定 UI 选择器脆，落库另由 A 保证）。需 P5 可选（纯引擎参数不依赖后端）。
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  // 绕登录门（#54 home 门 + App 守卫）：注入 player auth；并 mock 静默续期成功——
  // preview 无后端时 pbRefresh 收到 500 会 clearAuth 拆掉假登录态（与 ui-smoke 同款处理）。
  await page.addInitScript(() => {
    try { localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e', account: { id: 'e2e-player', kind: 'player', nickname: 'e2e' } })); } catch { /* noop */ }
  });
  await page.route(/auth-refresh/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e', record: {} }) }));

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
  const guantuRerolls = await page.$$('[data-doubles-reroll]');
  expect(guantuRerolls.length === 15, `官突重揉入口=指挥官6+因子9（实=${guantuRerolls.length}）`);
  await guantuRerolls[0].click(); await page.waitForTimeout(300);
  const g2 = await page.evaluate(() => window.__jjbDebug?.doubles || {});
  expect(g2.reroll?.count === 1, `官突重揉后 count=1（实=${g2.reroll?.count}）`);
  expect(new Set(g2.commanderPool || []).size === (g2.commanderPool || []).length, '官突重揉后 commanderPool 无重复');
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
  const feiqiuRerolls = await page.$$('[data-doubles-reroll]');
  expect(feiqiuRerolls.length === 0, `非酋无重揉入口（实=${feiqiuRerolls.length}）`);
  await shot(page, 'doubles-feiqiu');
});
done('doubles-match');
