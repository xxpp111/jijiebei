// ladder.flow.mjs — 积分天梯 flow：3 tab（总/单刷/双打）渲染 + 切换 on + board 稳定态。
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  await page.goto(`${baseUrl}/?screen=ladder&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tabs = await page.$$('[data-lad-tab]');
  expect(tabs.length === 3, `分榜 3 tab（总/单刷/双打），实=${tabs.length}`);
  const st = await page.evaluate(() => document.querySelector('.lad-empty') ? 'empty' : document.querySelector('[data-lad-row]') ? 'ranked' : 'loading');
  expect(['ranked', 'empty'].includes(st), `天梯进稳定态（ranked/empty），实=${st}`);
  await shot(page, 'ladder-all');
  // 切单刷 → 双打，验 tab on 切换
  await page.click('[data-lad-tab="single"]'); await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.querySelector('[data-lad-tab="single"]')?.classList.contains('on')), '单刷 tab 切换 on');
  await page.click('[data-lad-tab="double"]'); await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.querySelector('[data-lad-tab="double"]')?.classList.contains('on')), '双打 tab 切换 on');
  await shot(page, 'ladder-double');
});
done('ladder');
