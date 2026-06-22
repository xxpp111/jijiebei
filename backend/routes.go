// routes.go: 自定义 API 路由 — 天梯聚合 + 系数读取。
//
// /api/rankings?season=<可选>  天梯 = scores 按 season 聚合 SUM(delta) GROUP BY player，
//   join players 拿 nickname/player_code/race_pref，active=1 过滤，按 total_delta DESC 排序。
//   读默认公开（与 scores/players listRule="" 一致，直播/观众无登录可读天梯）。
//
// /api/scoring  读当前系数表 + 赛季 + 公式（天梯页展示计分规则用，公开）。
//
// 路由在 OnServe 内绑定（v0.39 模式：se.Router.GET(path, handler)）。
package main

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func registerRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/rankings", rankingsHandler)
		se.Router.GET("/api/scoring", scoringHandler)
		return se.Next()
	})
}

// rankingsHandler: 天梯聚合（SUM(delta) GROUP BY player）。
func rankingsHandler(e *core.RequestEvent) error {
	season := e.Request.URL.Query().Get("season")
	if season == "" {
		season = currentSeason()
	}

	// scores.player 存 player record id（字符串），JOIN s.player = p.id。
	// COUNT(s.id) = 该选手本赛季已记分对局数（非总局数，因 scores 仅 match mode 派生）。
	q := `SELECT p.id AS player_id, p.nickname, p.player_code, p.race_pref,
			COALESCE(SUM(s.delta), 0) AS total_delta,
			COUNT(s.id) AS match_count
		FROM players p
		LEFT JOIN scores s ON s.player = p.id AND s.season = {:season}
		WHERE p.active = 1
		GROUP BY p.id
		ORDER BY total_delta DESC, p.nickname ASC`

	type rankingRow struct {
		PlayerID   string  `json:"player_id"`
		Nickname   string  `json:"nickname"`
		PlayerCode string  `json:"player_code"`
		RacePref   string  `json:"race_pref"`
		TotalDelta float64 `json:"total_delta"`
		MatchCount int     `json:"match_count"`
	}
	var rows []rankingRow
	if err := e.App.DB().NewQuery(q).Bind(dbx.Params{"season": season}).All(&rows); err != nil {
		return e.BadRequestError("rankings query failed", err)
	}

	// 序号（按 total_delta DESC 排名，同分同号）
	for i := range rows {
		_ = i // rank 由前端按数组下标算；此处返回有序数组
	}

	return e.JSON(http.StatusOK, map[string]any{
		"season":   season,
		"count":    len(rows),
		"rankings": rows,
	})
}

// scoringHandler: 读当前系数表 + 赛季 + 公式（天梯页展示用）。
func scoringHandler(e *core.RequestEvent) error {
	cfg := currentScoring()
	if cfg == nil {
		return e.JSON(http.StatusOK, map[string]any{
			"current_season":       "default",
			"coefficients":         map[string]float64{},
			"default_coefficient":  1.0,
			"formula":              "delta = wins × coefficient[game_mode]",
			"note":                 "scoring config not loaded (using defaults)",
		})
	}
	return e.JSON(http.StatusOK, map[string]any{
		"current_season":      cfg.CurrentSeason,
		"coefficients":        cfg.Coefficients,
		"default_coefficient": cfg.DefaultCoefficient,
		"formula":             "delta = wins × coefficient[game_mode]",
	})
}
