import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'vite';
import { pass, fail, done } from './lib/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const projectRoot = resolve(webRoot, '..');
const server = await createServer({
  root: webRoot,
  configFile: false,
  resolve: { alias: { '@logic': resolve(projectRoot, 'assets/Script/jijie2'), '@jjb': resolve(projectRoot, 'assets/Script/jjbDesign') } },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: true, target: 'node' },
});
try {
  globalThis.window = globalThis.window || globalThis;
  const { setRandomEnemyEnabled } = await server.ssrLoadModule('/src/logic/randomConfig.ts');
  const { AI_ENEMY_POOL } = await server.ssrLoadModule('/src/data/aiEnemyPool.ts');
  const { clearEnemyRolls, getEnemyRoll, rollEnemiesForSession, shouldUsePotatoBias } = await server.ssrLoadModule('/src/logic/aiEnemySelector.ts');

  const sequence = (...values) => {
    let index = 0;
    return () => values[index++];
  };
  const mech = AI_ENEMY_POOL.find((entry) => entry.id === 'T_MechClassic');
  const mechIndex = AI_ENEMY_POOL.indexOf(mech);
  setRandomEnemyEnabled(true);

  rollEnemiesForSession(3, sequence(0.1, 0.2, 0.3), true);
  if ([0, 1, 2].every((index) => getEnemyRoll(index)?.id === 'T_MechClassic' && getEnemyRoll(index)?.potatoFriend)) pass('① bias 直达：三场均旧世机械团且标记老朋友');
  else fail('① bias 直达应三场均为 T_MechClassic');

  rollEnemiesForSession(1, sequence(0.75, mechIndex / AI_ENEMY_POOL.length), true);
  if (getEnemyRoll(0)?.id === 'T_MechClassic' && getEnemyRoll(0)?.potatoFriend) pass('② fallback 完整池自然命中旧世机械团也标记老朋友');
  else fail('② fallback 自然命中应标记老朋友');

  let calls = 0;
  rollEnemiesForSession(1, () => { calls += 1; return 0; }, false);
  if (calls === 1 && getEnemyRoll(0)?.potatoFriend === undefined) pass('③ 非触发路径只消费一次 RNG 且不标记');
  else fail(`③ 非触发 RNG=${calls} 或标记异常`);

  if (shouldUsePotatoBias(true, ['普通']) && shouldUsePotatoBias(false, ['小土豆']) && shouldUsePotatoBias(false, ['普通', '土豆队']) && !shouldUsePotatoBias(false, ['普通'])) pass('④ 账号、单打名、双打任一名字均正确触发');
  else fail('④ 触发条件不符合规格');

  setRandomEnemyEnabled(false);
  rollEnemiesForSession(3, () => { throw new Error('OFF 不得调用 RNG'); }, true);
  if (!getEnemyRoll(0)) pass('⑤ 随机敌方关闭时不生成结果');
  else fail('⑤ OFF 时应无敌方');
  clearEnemyRolls();
} finally {
  await server.close();
}
done('potato-ai-bias');
