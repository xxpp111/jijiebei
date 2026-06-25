// single-match.flow.mjs — 单刷比赛全流程：home 比赛tab登录入口 → select 随机填充 → battle 判定改 score。
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  // home 比赛 tab → 主播登录入口
  await page.goto(`${baseUrl}/?screen=home&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const matchTab = await page.$('[data-home-tab="match"]');
  if (matchTab) { await matchTab.click(); await page.waitForTimeout(400); }
  expect(await page.$('[data-nav-login]'), '比赛态主播登录入口可见');
  await shot(page, 'single-home');

  // select 随机填充 → 3 场槽位
  await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const fill = await page.$('[data-rerandom-btn]');
  if (fill) { await fill.click(); await page.waitForTimeout(500); }
  expect((await page.$$('[data-slot-idx]')).length === 3, 'select 3 场槽位渲染');
  await shot(page, 'single-select');

  // battle 判定改 score（__jjbDebug 硬断言）
  await page.goto(`${baseUrl}/?screen=battle&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const vbtns = await page.$$('.v-btn');
  expect(vbtns.length >= 3, `判定按钮 ≥3（实=${vbtns.length}）`);
  if (vbtns[0]) await vbtns[0].click();
  await page.waitForTimeout(300);
  const score = await page.evaluate(() => window.__jjbDebug?.battle?.score ?? -1);
  expect(score >= 1, `点第1场胜利后 score≥1（__jjbDebug 实=${score}）`);
  await shot(page, 'single-battle');
});
done('single-match');
