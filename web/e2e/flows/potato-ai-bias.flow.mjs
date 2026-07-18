import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl, errors }) => {
  await page.addInitScript(() => {
    localStorage.setItem('jjb_random_enemy', '1');
    localStorage.setItem('jjb_auth', JSON.stringify({ token: 'flow-token', account: { id: 'flow-host', kind: 'host', role: 'host' } }));
    Math.random = () => 0.1;
  });
  await page.route('**/api/collections/accounts/auth-refresh', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ token: 'flow-token', record: { id: 'flow-host', role: 'host', potato_ai_bias: false } }),
  }));
  await page.goto(`${baseUrl}/?screen=bpconfig`, { waitUntil: 'networkidle' });
  const toggle = page.locator('[data-random-enemy]');
  if (await toggle.getAttribute('data-random-enemy') !== '1') await toggle.click();

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.locator('[data-player-input]').fill('儒雅随和の土豆');
  await page.locator('[data-mode-btn="std8"]').click();
  await page.waitForSelector('[data-screen-label^="select-"]');
  const selectBadges = page.locator('[data-enemy-easter-egg="potato-friend"]');
  expect(await selectBadges.count() === 3, 'Select 三场均显示土豆彩蛋');
  expect(await page.locator('.menemy-nm').allTextContents().then((names) => names.every((name) => name === '旧世机械团')), 'Select 三场均为旧世机械团');
  await shot(page, 'potato-select');

  await page.locator('[data-random-fill-btn]').click();
  await page.locator('[data-start-btn]').click();
  await page.waitForSelector('[data-screen-label^="battle-"]');
  expect(await page.locator('[data-enemy-easter-egg="potato-friend"]').count() === 3, 'Battle 三场均显示土豆彩蛋');
  await shot(page, 'potato-battle');

  await page.locator('[data-nav-obs]').click();
  await page.waitForSelector('[data-screen-label^="obs-"]');
  const obsBadges = page.locator('[data-enemy-easter-egg="potato-friend"]');
  expect(await obsBadges.count() === 3, 'OBS 三场均显示紧凑彩蛋');
  const geometry = await obsBadges.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, right: box.right };
  }));
  expect(geometry.every((box) => box.top >= 0 && box.bottom <= 232 && box.right <= 1280), 'OBS 1280×232 彩蛋无溢出');
  await shot(page, 'potato-obs-1280x232');
}, { viewport: { width: 1280, height: 232 } });

done('potato-ai-bias.flow');
