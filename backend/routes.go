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
	"encoding/json"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func registerRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/rankings", rankingsHandler)
		se.Router.GET("/api/scoring", scoringHandler)
		se.Router.GET("/api/event-rules", eventRulesHandler)
		return se.Next()
	})
}

// rankingsHandler: 天梯聚合。
//
// 件1 战绩真实化：除 total_delta（积分）外，加 total_wins=SUM(s.wins)/total_games=SUM(s.games)
//   供前端 LadderScreen 显「胜/总」战绩（替代旧 match_count「赛季对局」占位）。
//   wins/games 为件1 migration 新增字段；旧 score 记录该字段为 nil，COALESCE 兜底 0（旧选手战绩显 0/0 不报错）。
//   match_count=COUNT(s.id) 保留返（兼容/调试，前端不再用作主战绩列）。
func rankingsHandler(e *core.RequestEvent) error {
	season := e.Request.URL.Query().Get("season")
	if season == "" {
		season = currentSeason()
	}

	// 分榜：?board=single|double|all（默认 all 全模式，兼容现状）。
	// 方案B（零迁移）：board 过滤移到 LEFT JOIN scores 的 ON 子句，用 s.match 子查询限定 game_mode，
	//   SUM 只算该 board 的 scores；player 仍 LEFT JOIN 全保留（无该 board 对局 → COALESCE 0 分上榜）。
	//   board 白名单枚举 + game_mode 硬编码列表，boardCond 为固定 SQL 片段不拼用户输入 → 无注入。
	//   双打集合={doubles,feiqiu-doubles}；单刷=其余全部（NOT IN，含未来开放的 one-a/hard*/feiqiu/suiji）。
	board := e.Request.URL.Query().Get("board")
	boardCond := ""
	switch board {
	case "double":
		boardCond = " AND s.match IN (SELECT id FROM matches WHERE game_mode IN ('doubles','feiqiu-doubles'))"
	case "single":
		boardCond = " AND s.match IN (SELECT id FROM matches WHERE game_mode NOT IN ('doubles','feiqiu-doubles'))"
	default:
		board = "all" // 空/非法 → 全模式
	}

	// scores.player 存 player record id（字符串），JOIN s.player = p.id。
	q := `SELECT p.id AS player_id, p.nickname, p.player_code, p.race_pref,
			COALESCE(SUM(s.delta), 0) AS total_delta,
			COALESCE(SUM(s.wins), 0) AS total_wins,
			COALESCE(SUM(s.games), 0) AS total_games,
			COUNT(s.id) AS match_count
		FROM players p
		LEFT JOIN scores s ON s.player = p.id AND s.season = {:season}` + boardCond + `
		WHERE p.active = 1
		GROUP BY p.id
		ORDER BY total_delta DESC, p.nickname ASC`

	type rankingRow struct {
		PlayerID   string  `json:"player_id"`
		Nickname   string  `json:"nickname"`
		PlayerCode string  `json:"player_code"`
		RacePref   string  `json:"race_pref"`
		TotalDelta float64 `json:"total_delta"`
		TotalWins  int     `json:"total_wins"`
		TotalGames int     `json:"total_games"`
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
		"board":    board,
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

// eventRulesHandler: 返回 event_rules 集合中 active=true 的赛事 ban 规则。
// GET /api/event-rules → {season, ban_maps:[], ban_factors:[], ban_mutators:[]}
// 无 active 行时返回空 ruleset（前端正常开局，无 ban）。
func eventRulesHandler(e *core.RequestEvent) error {
	empty := map[string]any{
		"season":       "",
		"ban_maps":     []string{},
		"ban_factors":  []string{},
		"ban_mutators": []string{},
	}
	records, err := e.App.FindRecordsByFilter("event_rules", "active=true", "-id", 1, 0)
	if err != nil || len(records) == 0 {
		return e.JSON(http.StatusOK, empty)
	}
	rec := records[0]
	return e.JSON(http.StatusOK, map[string]any{
		"season":       rec.GetString("season"),
		"ban_maps":     parseJSONStringSlice(rec.Get("ban_maps")),
		"ban_factors":  parseJSONStringSlice(rec.Get("ban_factors")),
		"ban_mutators": parseJSONStringSlice(rec.Get("ban_mutators")),
	})
}

// parseJSONStringSlice 把 PocketBase JSONField 值（types.JsonRaw / []byte / string / []any）解为 []string。
func parseJSONStringSlice(v interface{}) []string {
	if v == nil {
		return []string{}
	}
	if arr, ok := v.([]any); ok {
		s := make([]string, 0, len(arr))
		for _, x := range arr {
			if str, ok := x.(string); ok {
				s = append(s, str)
			}
		}
		return s
	}
	var b []byte
	switch val := v.(type) {
	case []byte:
		b = val
	case string:
		b = []byte(val)
	default:
		raw, err := json.Marshal(v)
		if err != nil {
			return []string{}
		}
		b = raw
	}
	var result []string
	if err := json.Unmarshal(b, &result); err != nil {
		return []string{}
	}
	return result
}
