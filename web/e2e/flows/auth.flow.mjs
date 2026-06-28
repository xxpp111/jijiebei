// e2e/flows/auth.flow.mjs — 需求1 登录权限 e2e flow（测试体系第③层）。
// 补 login.flow.mjs 缺的：选手注册 / 登录 / 双 tab / 记住我 三段（断言纪律：DOM 硬断言 + 截图 + 真落库）。
//
// 起隔离 PB（8090，临时 dir）+ vite preview（/api proxy→8090），registerPlayer/pbAuthPlayer 经
// 同源 proxy 真调落库 → success banner 本身即验链路通（proxy 不通则 banner error，flow FAIL）。
import { startIsoPb, stopIsoPb } from '../lib/isopb.mjs';
import { withPreview, expect, done, shot } from '../lib/harness.mjs';

// 唯一手机号（139 + 时间戳后 8 位 = 11 位，避 phone unique 400）
const phone = `139${String(Date.now()).slice(-8)}`;
const PWD = 'Pwd12345';
const REG = '?screen=register&style=sc2&mode=dark';
const LOGIN = '?screen=login&style=sc2&mode=dark';

const pb = await startIsoPb();
try {
  await withPreview(async (page, { baseUrl }) => {
    // ① 注册屏：渲染 22 指挥官 + 4 字段 → 填表 → 点 2 指挥官 → 注册 → success banner（真落库）
    await page.goto(`${baseUrl}/${REG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.reg-stage', { timeout: 15000 });
    await page.waitForTimeout(300);
    const nCmd = (await page.$$('[data-reg-cmd]')).length;
    const nField = (await page.$$('[data-reg-field]')).length;
    expect(nCmd === 22, `注册屏 [data-reg-cmd] ×22（official18+cm4）实际 ${nCmd}`);
    expect(nField === 4, `注册屏 [data-reg-field] ×4（昵称/手机号/密码/确认）实际 ${nField}`);
    await page.fill('[data-reg-field="昵称"]', '测试选手');
    await page.fill('[data-reg-field="手机号"]', phone);
    await page.fill('[data-reg-field="密码"]', PWD);
    await page.fill('[data-reg-field="确认密码"]', PWD);
    await page.click('[data-reg-cmd="雷诺"]');
    await page.click('[data-reg-cmd="诺温"]');
    await page.click('[data-reg-btn]');
    await page.waitForFunction(() => !!document.querySelector('[data-reg-banner]'), { timeout: 8000 });
    const regBanner = await page.evaluate(() => document.querySelector('[data-reg-banner]')?.getAttribute('data-reg-banner') || 'none');
    expect(regBanner === 'success', `注册 → success banner（registerPlayer+pbAuthPlayer 经 proxy 真落库）实际 ${regBanner}`);
    await shot(page, 'auth-register');

    // ② 登录屏：默认选手 tab → 填 phone+密码 → 勾记住我 → 登录 success
    await page.goto(`${baseUrl}/${LOGIN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.login-stage', { timeout: 15000 });
    await page.waitForTimeout(300);
    const playerTabOn = await page.evaluate(() => !!document.querySelector('.login-tab.on[data-login-tab="player"]'));
    expect(playerTabOn, '默认选手 tab on（选手优先）');
    await page.fill('[data-login-acct]', phone);
    await page.fill('[data-login-pwd]', PWD);
    await page.click('[data-login-remember] input[type="checkbox"]');
    await page.click('[data-login-btn]');
    await page.waitForFunction(() => !!document.querySelector('[data-login-banner]'), { timeout: 8000 });
    const loginBanner = await page.evaluate(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') || 'none');
    expect(loginBanner === 'success', `选手登录 → success banner 实际 ${loginBanner}`);

    // ③ 记住我分流：remember=true → localStorage 有 jjb_auth（跨会话持久）、sessionStorage 空（已切持久层）
    const storage = await page.evaluate(() => ({
      local: window.localStorage.getItem('jjb_auth'),
      session: window.sessionStorage.getItem('jjb_auth'),
    }));
    expect(!!storage.local, '记住我 → localStorage jjb_auth 非空（跨会话自动登录持久层）');
    expect(storage.session === null, `记住我 → sessionStorage 空（persistAuth 已切 localStorage）实际 ${storage.session}`);

    // 主播 tab placeholder 切换（趁 success→onSuccess 跳转窗口前）
    await page.click('[data-login-tab="host"]');
    await page.waitForTimeout(200);
    const hostPh = await page.evaluate(() => document.querySelector('[data-login-acct]')?.placeholder);
    expect(hostPh === '主播账号', `host tab → acct placeholder「主播账号」实际「${hostPh}」`);
    await shot(page, 'auth-login-host');
  });
} finally {
  await stopIsoPb(pb);
}
done('auth');
