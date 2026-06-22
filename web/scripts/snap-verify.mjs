// P2 snapDOM 视觉验证：加载 dev server 3 屏，用 window.__jjbCapture.captureNodeToBlob 截 [data-capture] 为 PNG。
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:7788/';
const OUT = '/Users/bytedance/项目/jijiebei/tmp/';

for (let i = 0; i < 40; i++) {
  try { await (await fetch(BASE)).text(); break; } catch { await new Promise(r => setTimeout(r, 500)); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const screens = [
  { url: BASE + '?screen=result&style=metal&mode=std8', sel: 'result' },
  { url: BASE + '?screen=select&style=metal&mode=std8', sel: 'select' },
  { url: BASE + '?screen=obs&style=metal&mode=std8', sel: 'obs' },
];

for (const s of screens) {
  await page.goto(s.url);
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  const data = await page.evaluate(async (sel) => {
    try {
      const cap = window.__jjbCapture;
      if (!cap) return { error: 'no __jjbCapture (capture.ts not loaded)' };
      await cap.warmupFonts();
      const el = document.querySelector(`[data-capture="${sel}"]`);
      if (!el) return { error: 'no el for ' + sel };
      const b = await cap.captureNodeToBlob(el, { scale: 2 });
      const fr = new FileReader();
      return await new Promise(res => { fr.onload = () => res({ size: b.size, dataUrl: fr.result }); fr.readAsDataURL(b); });
    } catch (e) { return { error: String((e && e.message) || e) }; }
  }, s.sel);
  if (data.error) { console.log(`FAIL ${s.sel}: ${data.error}`); continue; }
  writeFileSync(OUT + `jjb-snap-${s.sel}.png`, Buffer.from(data.dataUrl.split(',')[1], 'base64'));
  console.log(`OK ${s.sel} size=${data.size} -> ${OUT}jjb-snap-${s.sel}.png`);
}
await browser.close();
console.log('DONE');
