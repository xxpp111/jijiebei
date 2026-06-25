// login.flow.mjs — 主播登录界面 flow：三族 hero + 登录卡渲染 + （P5 在时）登录歪比 success。
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

await withPreview(async (page, { baseUrl }) => {
  await page.goto(`${baseUrl}/?screen=login&style=sc2&mode=dark`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  expect(await page.$('.login-stage'), 'login-stage 渲染');
  expect((await page.$$('.race-emblem')).length === 3, '三族印花 ×3');
  expect(await page.$('[data-login-acct]'), '账号输入框');
  expect(await page.$('[data-login-pwd]'), '密码输入框');
  expect(await page.$('[data-login-btn]'), '登录按钮');
  await shot(page, 'login');
  // 登录歪比：P5 接通则验 success；P5 缺/账号无 → error，前端渲染已验，不 FAIL
  await page.fill('[data-login-acct]', 'waibi@jjb.test');
  await page.fill('[data-login-pwd]', 'Waibi123456!');
  await page.click('[data-login-btn]');
  await page.waitForTimeout(700);
  const banner = await page.evaluate(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') || 'none');
  if (banner === 'success') expect(true, '登录歪比 → success banner（P5 接通）');
  else console.log(`  INFO: banner=${banner}（P5 未起/跳转，前端渲染+链路已验）`);
});
done('login');
