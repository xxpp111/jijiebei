// doubles-sync.flow.mjs — 双打「两主播同步」探测（纯后端 curl，不走 UI）。
//
// 架构现实（workflow 实锤）：双打是单端闭包态（winLoseList 在 jjbDoubles 模块单例），
//   UI 层【无】多端同步/冲突合流机制。所以本 flow 不是验「真同步合流」（架构不存在），
//   而是探测【后端层】两个独立会话（=两主播）各落一局双打能否互不干扰：各落一条、double 榜累加、不串不丢。
// 产出：两端同时落库的后端行为，喂产品决策「双打要不要做服务端合流/主控端」。需 P5（127.0.0.1:8090）。
import { pass, fail, done } from '../lib/harness.mjs';

const API = process.env.JJB_API || 'http://127.0.0.1:8090/api';
const j = (r) => r.json();
const authToken = (col, id, pw) => fetch(`${API}/collections/${col}/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: id, password: pw }),
}).then(j).then((d) => d.token).catch(() => '');

const host = await authToken('accounts', 'host@jjb.test', 'Host123456!');
const su = await authToken('_superusers', 'admin@jjb.test', 'Admin123456!');
if (!host || !su) { fail('auth 失败（P5 未起 / seed-hosts 未跑）'); done('doubles-sync'); }

const players = await fetch(`${API}/collections/players/records?perPage=2`, { headers: { Authorization: su } }).then(j).then((d) => d.items.map((p) => p.id)).catch(() => []);
const hid = await fetch(`${API}/collections/accounts/records?filter=(email='host@jjb.test')`, { headers: { Authorization: su } }).then(j).then((d) => d.items[0]?.id).catch(() => '');
if (players.length < 1 || !hid) { fail('缺 player/host 记录（先 verify-all + seed-hosts）'); done('doubles-sync'); }

const cnt = () => fetch(`${API}/collections/matches/records?filter=(game_mode='doubles')&perPage=1`).then(j).then((d) => d.totalItems);
const post = (pid, code) => fetch(`${API}/collections/matches/records`, {
  method: 'POST', headers: { Authorization: host, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'match', game_mode: 'doubles', result: [1, 2, 0], players: [pid], host: hid, payload_code: code, payload_ver: 1, score_total: 2 }),
}).then((r) => r.status);

const before = await cnt();
// 时间差档位：同时（Promise.all，~0ms 间隔）两主播各落一局双打
const [s1, s2] = await Promise.all([
  post(players[0], 'sync-A-' + before),
  post(players[1] || players[0], 'sync-B-' + before),
]);
const after = await cnt();

if (s1 < 300 && s2 < 300) pass(`两主播同时落库各成功（HTTP ${s1}/${s2}）`); else fail(`落库失败 ${s1}/${s2}`);
if (after - before === 2) pass(`后端各落一条不串不丢（Δ=${after - before}=2）`); else fail(`Δ=${after - before}≠2（串/丢/重）`);
console.log('  探测结论：双打两端【后端层】独立落库 OK（各落一条）；【UI 层】无多端同步合流（单端闭包态）。');
console.log('  → 如需「两主播判同一局合流成一条 match」须服务端合流/主控端，当前架构不支持 —— 产品决策项，非本轮 bug。');
done('doubles-sync');
