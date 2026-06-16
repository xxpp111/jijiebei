// 轻量 react-e2e 门：验证 build 产物完整 + bundle 含接缝关键标记（属性名 / JSX 文本，minify 保留）。
// 段1 PoC 的真·浏览器 e2e（__jjbDebug.battle 断言 + 多主题/多视口实拍）已由 Playwright MCP 完成
// （见 /tmp/jjb-react-poc/）；此脚本是 CI 友好的轻量完整性门，全自动化浏览器 e2e 留段2 CI。
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('FAIL: dist/index.html missing — run `npm run build` first');
  process.exit(1);
}
const assetsDir = join(dist, 'assets');
const js = readdirSync(assetsDir).find((f) => f.endsWith('.js'));
if (!js) {
  console.error('FAIL: no js bundle in dist/assets');
  process.exit(1);
}
const bundle = readFileSync(join(assetsDir, js), 'utf8');
const markers = ['__jjbDebug', 'winLoseList', '集结杯'];
const missing = markers.filter((m) => !bundle.includes(m));
if (missing.length) {
  console.error('FAIL: bundle missing接缝 markers:', missing.join(', '));
  process.exit(1);
}
console.log('react-e2e OK: dist complete; bundle contains', markers.join(' / '));
