// scoring_test: 积分系数表回归（测试体系第①层 · backend）。
// 被测：backend/scoring.go calcDelta = coefFor(gameMode) × wins。
// 期望值来源：backend/config/scoring.json 真表（11 模式系数 + default_coefficient=1.0，grep 实测）。
// 防的是：系数表改了 / 默认值漂移，算分静默回归（天梯上线前最高危）。
package main

import (
	"math"
	"testing"
)

func TestLoadAndCalcDelta(t *testing.T) {
	if err := loadScoring("config/scoring.json"); err != nil {
		t.Fatalf("loadScoring: %v", err)
	}

	// 期望系数来自 scoring.json 真表；delta = wins × coef（容差吸收 float64 乘法误差，如 3×1.1≠3.3 精确）。
	cases := []struct {
		mode     string
		wins     int
		wantCoef float64
	}{
		{"std8", 1, 1.0},
		{"std10", 3, 1.1},
		{"std12", 2, 1.2},
		{"rescue", 2, 1.3},
		{"one-a", 3, 1.1},
		{"hard1", 2, 1.3},
		{"hard2", 0, 1.3}, // wins=0 → delta=0，coef 仍按模式
		{"feiqiu", 1, 1.0},
		{"suiji", 3, 1.0},
		{"doubles", 2, 1.0},
		{"feiqiu-doubles", 2, 1.0},
		{"unknown-mode", 3, 1.0}, // 未知模式回退 default_coefficient=1.0
	}

	for _, c := range cases {
		delta, coef := calcDelta(c.mode, c.wins)
		wantDelta := float64(c.wins) * c.wantCoef
		if math.Abs(coef-c.wantCoef) > 1e-9 {
			t.Errorf("calcDelta(%q) coef=%v, want %v", c.mode, coef, c.wantCoef)
		}
		if math.Abs(delta-wantDelta) > 1e-9 {
			t.Errorf("calcDelta(%q,%d) delta=%v, want %v", c.mode, c.wins, delta, wantDelta)
		}
	}
}

func TestCoefForUnknownFallsBackToDefault(t *testing.T) {
	if err := loadScoring("config/scoring.json"); err != nil {
		t.Fatalf("loadScoring: %v", err)
	}
	// 未知模式必须回退 default_coefficient（=1.0），不得返回 0（否则 delta=0 把选手分吞掉）。
	if c := coefFor("totally-unknown-game-mode"); c != 1.0 {
		t.Errorf("coefFor(unknown)=%v, want 1.0 (default_coefficient)", c)
	}
}

func TestCurrentSeason(t *testing.T) {
	if err := loadScoring("config/scoring.json"); err != nil {
		t.Fatalf("loadScoring: %v", err)
	}
	// 真值来自 scoring.json current_season（grep 实测 = 2026S1）；天梯分赛季聚合键。
	if s := currentSeason(); s != "2026S1" {
		t.Errorf("currentSeason()=%q, want 2026S1", s)
	}
}
