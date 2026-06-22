// scoring.go: 积分系数表加载 + delta 计算。
//
// 设计：系数表 config/scoring.json 启动时加载到全局（配置化，不硬编码进 hook）。
// delta = 获胜场数 × coefficients[game_mode]（最简纯累加，开放问题 #1 拍板：Elo 后续）。
// 获胜场数对齐 live jjbSession.getScore()：winLoseList 中 v==1(win) 或 v==2(bonus) 计胜，不双计。
// 赛季标识 current_season 从 scoring.json 读（天梯分赛季聚合键）。
//
// caveat 3: 真实系数（点金×2/双打/连胜/赛季周期）须 yb/土豆拍板定稿 — schema 用
// delta+reason+season 已留空间，改系数不动 schema，改 scoring.json 重启即可。
package main

import (
	"encoding/json"
	"os"
	"sync"
)

// ScoringConfig 镜像 config/scoring.json 结构。
type ScoringConfig struct {
	CurrentSeason      string             `json:"current_season"`
	Coefficients       map[string]float64 `json:"coefficients"`
	DefaultCoefficient float64            `json:"default_coefficient"`
}

var (
	scoringCfg *ScoringConfig
	scoringMu  sync.RWMutex
)

// loadScoring 从 path 读取系数表到全局（启动调一次）。
func loadScoring(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var cfg ScoringConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	if cfg.Coefficients == nil {
		cfg.Coefficients = map[string]float64{}
	}
	if cfg.DefaultCoefficient == 0 {
		cfg.DefaultCoefficient = 1.0
	}
	scoringMu.Lock()
	scoringCfg = &cfg
	scoringMu.Unlock()
	return nil
}

// currentScoring 返回当前系数表快照（hook/路由读）。
func currentScoring() *ScoringConfig {
	scoringMu.RLock()
	defer scoringMu.RUnlock()
	return scoringCfg
}

// currentSeason 返回当前赛季标识（空时回退 "default"）。
func currentSeason() string {
	if cfg := currentScoring(); cfg != nil && cfg.CurrentSeason != "" {
		return cfg.CurrentSeason
	}
	return "default"
}

// coefFor 返回 game_mode 的难度系数（未知模式回退 default_coefficient）。
func coefFor(gameMode string) float64 {
	cfg := currentScoring()
	if cfg == nil {
		return 1.0
	}
	if c, ok := cfg.Coefficients[gameMode]; ok && c > 0 {
		return c
	}
	return cfg.DefaultCoefficient
}

// calcDelta 按 game_mode 系数 × 获胜场数算天梯分增量，返回 (delta, coef)。
func calcDelta(gameMode string, wins int) (delta, coef float64) {
	coef = coefFor(gameMode)
	delta = float64(wins) * coef
	return
}
