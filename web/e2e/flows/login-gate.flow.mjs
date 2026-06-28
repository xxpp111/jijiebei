// e2e/flows/login-gate.flow.mjs — 需求1 登录门 flow（测试体系第③层 · Step5）。
// 验证：① 未登录点开局→引导 login ② 未登录直接 URL select→路由守卫踢回 home
//   ④⑤【公开读红线】未登录 obs?bare=1 / ladder → 不踢 home（直播采集/天梯匿名读绝不挡）
//   ⑥ 登录后点开局→放行进 select。
// 起隔离 PB（注册选手拿登录态），withPreview 起 preview。
import { startIsoPb, stopIsoPb } from '../lib/isopb.mjs';
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

const phone = `137${String(Date.now()).slice(-8)}`;
const PWD = 'Pwd12345';
const S = '&style=sc2&mode=dark';

const pb = await startIsoPb();
try {
  await withPreview(async (page, { baseUrl }) => {
    const atHome = () => page.evaluate(() => !!document.querySelector('[data-home-mode]'));
    const atLogin = () => page.evaluate(() => !!document.querySelector('.login-stage'));

    // ① 未登录点模式按钮 → 登录门引导 login（start 源头检查，不开局）
    await page.goto(`${baseUrl}/?screen=home${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-home-mode]', { timeout: 15000 });
    await page.click('[data-mode-btn="std8"]');
    await page.waitForTimeout(500);
    expect(await atLogin(), '① 未登录点模式按钮 → 引导 login（HomeScreen.start 登录门）');

    // ② 未登录直接 URL ?screen=select → App 路由守卫踢回 home
    await page.goto(`${baseUrl}/?screen=select${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);
    expect(await atHome(), '② 未登录 ?screen=select → 路由守卫踢回 home（防直接 URL 绕过）');

    // ④【公开读红线】未登录 obs?bare=1 → 直播采集屏渲染、绝不踢 home
    await page.goto(`${baseUrl}/?screen=obs&bare=1${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);
    expect(!(await atHome()), '④ 未登录 obs?bare=1 → 不踢 home（直播采集公开读红线）');

    // ⑤【公开读红线】未登录 ladder → 天梯榜渲染、绝不踢 home
    await page.goto(`${baseUrl}/?screen=ladder${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);
    expect(!(await atHome()), '⑤ 未登录 ladder → 不踢 home（天梯匿名读公开读红线）');
    await shot(page, 'login-gate-ladder');

    // ⑥ 登录后 → 模式按钮放行进 select（注册选手经 proxy 真落库 → 登录态入 storage）
    await page.goto(`${baseUrl}/?screen=register${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.reg-stage', { timeout: 15000 });
    await page.fill('[data-reg-field="昵称"]', '门测选手');
    await page.fill('[data-reg-field="手机号"]', phone);
    await page.fill('[data-reg-field="密码"]', PWD);
    await page.fill('[data-reg-field="确认密码"]', PWD);
    await page.click('[data-reg-btn]');
    await page.waitForFunction(() => document.querySelector('[data-reg-banner]')?.getAttribute('data-reg-banner') === 'success', { timeout: 8000 });
    // 已登录态在 storage → goto home 重载恢复 getAccount → 点模式按钮放行
    await page.goto(`${baseUrl}/?screen=home${S}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-home-mode]', { timeout: 15000 });
    await page.click('[data-mode-btn="std8"]');
    await page.waitForTimeout(700);
    expect(!(await atHome()) && !(await atLogin()), '⑥ 登录后点模式按钮 → 放行离开 home/login（进 select，门不再挡）');
    await shot(page, 'login-gate-pass');
  });
} finally {
  await stopIsoPb(pb);
}
done('login-gate');
