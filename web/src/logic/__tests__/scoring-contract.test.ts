// scoring-contract.test — 前端↔后端算分字符串契约（测试体系第①层 · 跨系统）。
// 背景：前端落库 game_mode = currentSessionMode()（MODE_DEFS 的 13 个 live 模式键），
// 后端 coefFor(game_mode) 查 backend/config/scoring.json——缺 key 会静默回退 default_coefficient=1.0。
// 2026-07-06 对抗审查坐实真实事故形态：std15/cm（Batch C 双打化后已 live）缺配，15 因子局静默按 1.0
// 记分（比 std12 的 1.2 还低）；而 scoring_test.go 的 unknown→1.0 用例反而把缺配「认证为正确」。
// 本测试把缺口锁死：每个 MODE_DEFS live 模式键都必须在 scoring.json coefficients 里显式配数值——
// unknown→default 兜底只许兜「真未知」，不许兜「加了新模式忘配系数」。
import { describe, it, expect } from 'vitest';
import { MODE_DEFS } from '../../config/modes';
// resolveJsonModule 直接吃后端真表（web tsconfig 已开）——tsc 顺带校验路径，文件挪位即编译报错。
import scoringJson from '../../../../backend/config/scoring.json';

const scoring = scoringJson as {
  coefficients: Record<string, number>;
  default_coefficient: number;
};

describe('前端 live 模式 ⊆ scoring.json 显式系数（防新模式静默 1.0 错分）', () => {
  for (const mode of Object.keys(MODE_DEFS)) {
    it(`${mode} 在 coefficients 里有显式数值系数`, () => {
      expect(
        typeof scoring.coefficients[mode],
        `game_mode='${mode}' 缺显式系数——后端会静默回退 default_coefficient=${scoring.default_coefficient} 错分。` +
        `新模式上线必须同步在 backend/config/scoring.json 补 key（值可先占位，#91 拍板可调）。`,
      ).toBe('number');
    });
  }

  it('default_coefficient 存在（真未知模式的兜底，不得当缺配的遮羞布）', () => {
    expect(typeof scoring.default_coefficient).toBe('number');
  });
});
