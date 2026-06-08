/* 集结杯 × CM — shared data */
(function () {
  const A = 'assets/';

  const MODES = [
    { no: '01', name: '8 因子模式', tag: '标准' },
    { no: '02', name: '10 因子模式', tag: '进阶' },
    { no: '03', name: '12 因子模式', tag: '高难' },
    { no: '04', name: '拯救模式', tag: '限时' },
    { no: '05', name: '极难模式', tag: '残局' },
    { no: '06', name: '随机模式', tag: '抽取' },
  ];

  const FACTORS = [
    { id: 'blizzard', name: '暴风雪', img: A + 'factor-blizzard.png' },
    { id: 'nuke', name: '核弹打击', img: A + 'factor-nuke.png' },
    { id: 'money', name: '拿钱说话', img: A + 'factor-money.png' },
    { id: 'zombie', name: '丧尸大战', img: A + 'factor-zombie.png' },
    { id: 'void', name: '虚空裂隙', img: A + 'factor-void.png' },
    { id: 'lava', name: '岩浆爆发', img: A + 'factor-lava.png' },
  ];
  const F = Object.fromEntries(FACTORS.map((f) => [f.id, f]));

  const COMMANDERS = [
    { id: 'artanis', name: '阿塔尼斯', img: A + 'cmd-artanis.png' },
    { id: 'dehaka', name: '德哈卡', img: A + 'cmd-dehaka.png' },
    { id: 'kerrigan', name: '凯瑞甘', img: A + 'cmd-kerrigan.png' },
    { id: 'raynor', name: '雷诺', img: A + 'cmd-raynor.png' },
    { id: 'nova', name: '诺娃', img: A + 'cmd-nova.png' },
    { id: 'tychus', name: '泰凯斯', img: A + 'cmd-tychus.png' },
  ];
  const C = Object.fromEntries(COMMANDERS.map((c) => [c.id, c]));

  const MAPS = {
    korhal: { id: 'korhal', name: '克哈裂痕', img: A + 'map-korhal.png' },
    darkstar: { id: 'darkstar', name: '黑暗杀星', img: A + 'map-darkstar.png' },
    temple: { id: 'temple', name: '往日神庙', img: A + 'map-temple.png' },
  };

  // 3 matches — cmds is an array (1 = 单打, 2 = 双打). BOSS 战 demos 双打 + 更多因子.
  const MATCHES = [
    { slot: '第 1 场', map: MAPS.korhal, cmds: [C.kerrigan], factors: [F.lava, F.void, F.zombie], result: 'win' },
    { slot: '第 2 场', map: MAPS.darkstar, cmds: [C.raynor], factors: [F.money, F.blizzard, F.nuke], result: 'bonus' },
    { slot: 'BOSS 战', map: MAPS.temple, cmds: [C.artanis, C.kerrigan], factors: [F.void, F.lava, F.nuke, F.zombie, F.money], result: 'win', boss: true, doubles: true },
  ];

  const GROUP_A = [C.artanis, C.dehaka, C.kerrigan];
  const GROUP_B = [C.raynor, C.nova, C.tychus];
  const POOL = COMMANDERS.concat(Array.from({ length: 12 }, (_, i) => ({ id: 'ph' + i, ph: true })));

  // CM co-brand mark per style
  const MARK = {
    metal: A + 'logo-cm-gold.png',
    sc2: A + 'logo-cm-silver.png',
    minimal: A + 'logo-cm-vector.png',
  };

  const EVENT = {
    cn: '集结杯',
    en: 'REGROUP CUP',
    sub: '星际争霸二 · 合作任务比赛',
    org: 'CM × 集结杯 联合主办',
    host: '儒雅随和の土豆',
    links: [
      { k: 'CM 玩法说明', v: 'cm-coop.cc/how' },
      { k: 'B站主播', v: '儒雅随和の土豆' },
    ],
    qq: '879559913',
  };

  window.JJB = { MODES, FACTORS, F, COMMANDERS, C, MAPS, MATCHES, GROUP_A, GROUP_B, POOL, MARK, EVENT };
})();
