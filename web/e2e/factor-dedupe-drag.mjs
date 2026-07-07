// factor-dedupe-drag.mjs — Phase 5 因子拖拽去重 + 槽间移动 e2e。
import { withPreview, expect, done } from './lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e', account: { id: 'e2e-player', kind: 'player', nickname: 'e2e' } })); } catch { /* noop */ }
  });
  await page.route(/auth-refresh/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e', record: {} }) }));

  await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=std10&cb=factor-dedupe`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-pool-fac]');
  const firstFactor = await page.locator('[data-pool-fac]').first().getAttribute('data-pool-fac');

  await page.evaluate((fac) => window.__jjbE2E.setSelectedFac(0, 0, fac), firstFactor);
  let state = await page.evaluate(() => window.__jjbE2E.getSelectState().selectedFactorList || []);
  expect(state[0] === firstFactor, `池→图A 成功（slot0=${state[0]}）`);

  await page.evaluate((fac) => window.__jjbE2E.setSelectedFac(1, 0, fac), firstFactor);
  const dup = await page.evaluate(() => ({ list: window.__jjbE2E.getSelectState().selectedFactorList || [], warn: window.__jjbDebug?.selectWarn || '' }));
  expect(dup.list[3] == null, `同因子池→图B 被拒（slot3=${dup.list[3]}）`);
  expect(String(dup.warn).includes('因子已使用'), `重复拖入提示「因子已使用」（实=${dup.warn}）`);

  await page.evaluate((fac) => {
    window.__jjbE2E.clearFacSlot(0, 0);
    window.__jjbE2E.setSelectedFac(1, 0, fac);
  }, firstFactor);
  state = await page.evaluate(() => window.__jjbE2E.getSelectState().selectedFactorList || []);
  expect(state[0] == null && state[3] === firstFactor, `图A→图B 移动成功且源槽空（slot0=${state[0]} slot3=${state[3]}）`);

  await page.evaluate((fac) => {
    window.__jjbE2E.clearFacSlot(1, 0);
    window.__jjbE2E.setSelectedFac(1, 0, fac);
  }, firstFactor);
  state = await page.evaluate(() => window.__jjbE2E.getSelectState().selectedFactorList || []);
  expect(state[3] === firstFactor, `清空后可再从池拖同因子到图B（slot3=${state[3]}）`);
});

done('factor-dedupe-drag');
