// dragback-clear.mjs — Phase3 拖回候选区清除 e2e（单打+双打）。
// 验证：因子落槽→候选区空出(占位格)→从场次槽拖回候选区占位格→场次槽空、候选区恢复显示。
// 用 Playwright mouse 真实模拟 pointerdown/move/up（dragdrop.ts 用原生 pointer 事件 + getBoundingClientRect 吸附）。
import { withPreview, expect, pass, done, shot } from './lib/harness.mjs';

async function dragBetween(page, srcSelector, dstSelector) {
  const src = await page.$(srcSelector);
  const dst = await page.$(dstSelector);
  if (!src || !dst) throw new Error(`drag selectors missing: ${srcSelector}→${dstSelector}`);
  const sBox = await src.boundingBox();
  const dBox = await dst.boundingBox();
  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  const dx = dBox.x + dBox.width / 2;
  const dy = dBox.y + dBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // 分步 move 触发 pointermove（dragdrop 监听 window pointermove）
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + (dx - sx) * i / steps, sy + (dy - sy) * i / steps);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(150); // 等 onDrop + forceRerender
}

await withPreview(async (page, { baseUrl }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e', account: { id: 'e2e-player', kind: 'player', nickname: 'e2e' } })); } catch { /* noop */ }
  });
  await page.route(/auth-refresh/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e', record: {} }) }));

  // ===== 单打：std8，选第一个因子到 slot0，拖回候选区清除 =====
  await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=std8&cb=dragback-single`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-pool-fac]');

  // 用真实拖拽从池拖第一个因子到 slot0:0（触发 onDrop + forceRerender，占位格才会渲染）
  const firstFactor = await page.locator('[data-pool-fac]').first().getAttribute('data-pool-fac');
  await dragBetween(page, `[data-pool-fac="${firstFactor}"]`, '[data-slot-fac-target="0:0"]');
  await page.waitForTimeout(200);

  const afterPick = await page.evaluate(() => ({
    slot0: window.__jjbE2E.getSelectState().selectedFactorList[0],
    placeholders: document.querySelectorAll('[data-pool-fac-placeholder]').length,
  }));
  expect(afterPick.slot0 === firstFactor, `单打 落槽: slot0=${afterPick.slot0}`);
  expect(afterPick.placeholders === 1, `单打 候选区空出: 占位格=${afterPick.placeholders} (期望1)`);

  // 拖回：从 slot0 的因子拖到该因子的占位格
  const placeholderSelector = `[data-pool-fac-placeholder=""][data-pool-fac="${firstFactor}"]`;
  await dragBetween(page, '[data-slot-fac="0:0"]', placeholderSelector);

  const afterDragback = await page.evaluate((fac) => ({
    slot0: window.__jjbE2E.getSelectState().selectedFactorList[0],
    placeholders: document.querySelectorAll('[data-pool-fac-placeholder]').length,
    poolFrameRestored: document.querySelectorAll(`[data-pool-fac="${fac}"] .fx`).length,
  }), firstFactor);
  expect(afterDragback.slot0 == null, `单打 拖回清除: slot0=${afterDragback.slot0} (期望null)`);
  expect(afterDragback.placeholders === 0, `单打 候选区恢复: 占位格=${afterDragback.placeholders} (期望0)`);
  expect(afterDragback.poolFrameRestored === 1, `单打 候选区 FactorFrame 恢复: ${afterDragback.poolFrameRestored} (期望1)`);
  pass(`单打 拖回候选区清除: slot0 空✓ 候选区恢复 FactorFrame✓`);
  await shot(page, 'dragback-single');

  // ===== 双打：官突，选第一个因子到 slot0:0，拖回候选区清除 =====
  await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=doubles&cb=dragback-doubles`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-doubles-pool-fac]');

  const dblFirstFactor = await page.locator('[data-doubles-pool-fac]').first().getAttribute('data-doubles-pool-fac');
  // 用真实拖拽从池拖到 slot0:0（验证池→槽拖拽仍工作 + 准备拖回场景）
  await dragBetween(page, `[data-doubles-pool-fac="${dblFirstFactor}"]`, '[data-doubles-fac-target="0:0"]');
  await page.waitForTimeout(200);

  const dblAfterPick = await page.evaluate(() => {
    const dbg = window.__jjbDebug.doubles;
    return {
      slot0: dbg.selection.slots[0]?.factors[0],
      placeholders: document.querySelectorAll('[data-doubles-pool-fac-placeholder]').length,
    };
  });
  expect(dblAfterPick.slot0 === dblFirstFactor, `双打 落槽: slot0=${dblAfterPick.slot0}`);
  expect(dblAfterPick.placeholders === 1, `双打 候选区空出: 占位格=${dblAfterPick.placeholders} (期望1)`);

  // 拖回：从 slot0:0 拖到该因子的占位格
  const dblPlaceholderSelector = `[data-doubles-pool-fac-placeholder=""][data-doubles-pool-fac="${dblFirstFactor}"]`;
  await dragBetween(page, '[data-doubles-fac="0:0"]', dblPlaceholderSelector);

  const dblAfterDragback = await page.evaluate((fac) => {
    const dbg = window.__jjbDebug.doubles;
    return {
      slot0: dbg.selection.slots[0]?.factors[0],
      placeholders: document.querySelectorAll('[data-doubles-pool-fac-placeholder]').length,
      poolFrameRestored: document.querySelectorAll(`[data-doubles-pool-fac="${fac}"] .fx`).length,
    };
  }, dblFirstFactor);
  expect(dblAfterDragback.slot0 == null, `双打 拖回清除: slot0=${dblAfterDragback.slot0} (期望null)`);
  expect(dblAfterDragback.placeholders === 0, `双打 候选区恢复: 占位格=${dblAfterDragback.placeholders} (期望0)`);
  expect(dblAfterDragback.poolFrameRestored === 1, `双打 候选区 FactorFrame 恢复: ${dblAfterDragback.poolFrameRestored} (期望1)`);
  pass(`双打 拖回候选区清除: slot0 空✓ 候选区恢复 FactorFrame✓`);
  await shot(page, 'dragback-doubles');

  // ===== 双打崩溃路径回归（workflow blocker）：未选池因子误吸附到占位格(slot=-1)不得崩溃/卡死 =====
  // 旧代码 onPoolPointerDown 无 slot<0 守卫 → setDoublesFac(-1) TypeError + dragdrop 清理跳过 + 拖拽机永久卡死。
  const facA = await page.locator('[data-doubles-pool-fac]:not([data-doubles-pool-fac-placeholder])').first().getAttribute('data-doubles-pool-fac');
  await dragBetween(page, `[data-doubles-pool-fac="${facA}"]`, '[data-doubles-fac-target="1:0"]'); // 制造 facA 占位格
  await page.waitForTimeout(150);
  const facB = await page.locator('[data-doubles-pool-fac]:not([data-doubles-pool-fac-placeholder])').first().getAttribute('data-doubles-pool-fac');
  // 把未选的 facB 拖到 facA 的占位格(slot=-1 target)——旧代码在此崩溃
  await dragBetween(page, `[data-doubles-pool-fac="${facB}"]`, `[data-doubles-pool-fac-placeholder=""][data-doubles-pool-fac="${facA}"]`);
  const crash = await page.evaluate(() => {
    const dbg = window.__jjbDebug?.doubles;
    return { readable: !!dbg, slot1: dbg?.selection?.slots?.[1]?.factors?.[0] };
  });
  expect(crash.readable, `双打崩溃路径: 页面未崩溃(state 可读)`);
  expect(crash.slot1 === facA, `双打崩溃路径: slot1 仍是 facA、未被 -1 落子污染(实=${crash.slot1})`);
  // 拖拽机未卡死：再拖 facB 到 slot2:0 应成功（若旧 bug 卡死 active，后续拖拽全失效）
  await dragBetween(page, `[data-doubles-pool-fac="${facB}"]`, '[data-doubles-fac-target="2:0"]');
  const recover = await page.evaluate(() => window.__jjbDebug?.doubles?.selection?.slots?.[2]?.factors?.[0]);
  expect(recover === facB, `双打崩溃路径: 拖拽机未卡死、后续拖拽仍生效 slot2=${recover}`);
  pass(`双打 未选因子拖占位格: 不崩✓ 槽未污染✓ 拖拽机未卡死✓`);

  // ===== 点击清除回归（对抗审查 blocker）：场次槽因子/指挥官挂了 onPointerDown 后，纯点击(0 位移)必须仍能清除 =====
  // 根因：dragdrop onPointerUp 曾无条件盖 lastDropAt → 纯点击被 shouldSuppressClickClear 吞掉 onClick。
  // 修复：位移 < CLICK_MOVE_THRESHOLD 视为点击、不盖 lastDropAt。此断言用 0 位移的 down→up 模拟真实点击。
  async function clickCenter(sel) {
    const el = await page.$(sel);
    if (!el) return false;
    const b = await el.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await page.mouse.up(); // 0 位移 = 纯点击
    await page.waitForTimeout(150);
    return true;
  }
  // 单打 std12：随机填充后点击场次槽指挥官/因子，验证点击清除生效
  await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=std12&cb=clickclear`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-random-fill-btn]');
  await page.click('[data-random-fill-btn]'); await page.waitForTimeout(300);
  const read = () => page.evaluate(() => ({ cmd0: window.__jjbE2E.getSelectState().selectedCommanderList[0], fac0: window.__jjbE2E.getSelectState().selectedFactorList[0] }));
  const b0 = await read();
  expect(b0.cmd0 != null && b0.fac0 != null, `点击清除前置: 随机填充后 slot0 有指挥官(${b0.cmd0})+因子(${b0.fac0})`);
  await clickCenter('[data-slot-cmd="0"]');
  expect((await read()).cmd0 == null, `单打 指挥官纯点击清除生效(${b0.cmd0}→null)`);
  await clickCenter('[data-slot-fac="0:0"]');
  expect((await read()).fac0 == null, `单打 因子纯点击清除生效(${b0.fac0}→null)`);
  pass(`点击清除回归: 场次槽指挥官/因子 0 位移纯点击仍能清除（dragdrop 位移门槛生效）`);
});
done('dragback-clear');
