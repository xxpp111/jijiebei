// hooks.go: PocketBase record 事件 hook — 积分计算 + 审计埋点。
//
// Hook A（积分）: OnRecordAfterCreateSuccess("matches") — match 落库后，
//   mode=="match" 时按 result(winLoseList) 算获胜场 × game_mode 系数 = delta，
//   为每个 players 关系项写一条 scores（app.Save 绕过 API rules）+ 一条 score.adjust logs。
//   mode=="practice" 跳过算分（开放问题拍板：练习默认不落库/不计分）。
//   model-level hook 无 request context，auth 不可得 — 算分用 superuser 级 app.Save。
//
// 审计: match.create log 对所有 mode 写（practice 主动保存也审计）。
//
// result 直存 live winLoseList（[0|1|2,...]，RESULT_VAL lose0/win1/bonus2）。
// 获胜场 = v==1||v==2 计数，对齐 jjbSession.getScore()（win+bonus 不双计）。
package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/pocketbase/pocketbase/core"
)

func registerHooks(app core.App) {
	// match 落库后：审计 match.create（所有 mode）+ 算分（仅 match mode）。
	app.OnRecordAfterCreateSuccess("matches").BindFunc(func(e *core.RecordEvent) error {
		rec := e.Record

		// 审计：match.create（practice 主动保存也记录）
		if err := writeLog(e.App, nil, "match.create", "matches", rec.Id, map[string]any{
			"mode":      rec.GetString("mode"),
			"game_mode": rec.GetString("game_mode"),
			"host":      rec.GetString("host"),
		}); err != nil {
			log.Printf("[jjb] match.create audit log failed: %v", err)
		}

		// 算分：仅 mode=match（practice 跳过）
		if rec.GetString("mode") != "match" {
			return e.Next()
		}
		if err := scoreMatch(e.App, rec); err != nil {
			// afterCreate 已 persist match，scores 写失败不回滚 match — 暴露错误供排查。
			log.Printf("[jjb] scoreMatch failed for match %s: %v", rec.Id, err)
			return err
		}
		return e.Next()
	})

	// event_rules 单活跃 hook：存 active=true 时把其它行 active 置 false + 写 logs 审计。
	ensureSingleActive := func(e *core.RecordEvent) error {
		rec := e.Record
		if !rec.GetBool("active") {
			return e.Next()
		}
		// 把其它 active=true 的记录置 false（record ID 为 nanoid 字母数字，拼接安全）
		others, err := e.App.FindRecordsByFilter("event_rules", "active=true && id!='"+rec.Id+"'", "", 0, 0)
		if err != nil {
			log.Printf("[jjb] event_rules find others failed: %v", err)
			return e.Next()
		}
		for _, other := range others {
			other.Set("active", false)
			if saveErr := e.App.Save(other); saveErr != nil {
				log.Printf("[jjb] event_rules deactivate %s failed: %v", other.Id, saveErr)
			}
		}
		// 审计
		if logErr := writeLog(e.App, nil, "event_rules.activate", "event_rules", rec.Id, map[string]any{
			"season":      rec.GetString("season"),
			"deactivated": len(others),
			"updated_by":  rec.GetString("updated_by"),
		}); logErr != nil {
			log.Printf("[jjb] event_rules.activate audit log failed: %v", logErr)
		}
		return e.Next()
	}
	app.OnRecordAfterCreateSuccess("event_rules").BindFunc(ensureSingleActive)
	app.OnRecordAfterUpdateSuccess("event_rules").BindFunc(ensureSingleActive)
}

// scoreMatch 解析 match.result 算获胜场 × 系数 = delta，为每个 player 写 scores + score.adjust logs。
func scoreMatch(app core.App, match *core.Record) error {
	gameMode := match.GetString("game_mode")
	resultArr := parseWinLoseList(match.Get("result"))
	wins := countWins(match.Get("result"))
	games := len(resultArr) // 本局总局数 = len(winLoseList)（通常 BO3=3）
	delta, coef := calcDelta(gameMode, wins)
	season := currentSeason()
	playerIDs := match.GetStringSlice("players")
	reason := fmt.Sprintf("wins=%d/games=%d × coef=%.2f (%s) season=%s", wins, games, coef, gameMode, season)

	scoresCol, err := app.FindCollectionByNameOrId("scores")
	if err != nil {
		return fmt.Errorf("find scores collection: %w", err)
	}

	written := 0
	for _, pid := range playerIDs {
		if pid == "" {
			continue
		}
		s := core.NewRecord(scoresCol)
		s.Set("player", pid)
		s.Set("match", match.Id)
		s.Set("delta", delta)
		s.Set("wins", wins)   // 件1：本局该选手获胜场（v==1||v==2 计数）
		s.Set("games", games) // 件1：本局总局数（len winLoseList）
		s.Set("reason", reason)
		s.Set("season", season)
		if err := app.Save(s); err != nil {
			return fmt.Errorf("save score for player %s: %w", pid, err)
		}
		written++
	}

	// 审计：score.adjust
	if err := writeLog(app, nil, "score.adjust", "matches", match.Id, map[string]any{
		"wins":          wins,
		"coef":          coef,
		"delta":         delta,
		"season":        season,
		"game_mode":     gameMode,
		"players_count": written,
		"player_ids":    playerIDs,
	}); err != nil {
		log.Printf("[jjb] score.adjust audit log failed: %v", err)
	}

	return nil
}

// countWins 从 result 字段算获胜场（v==1 win 或 v==2 bonus 计胜，对齐 getScore() 不双计）。
// result 是 JsonField，PocketBase 可能返回 []any 或 []byte(JsonRaw)，两种都处理。
func countWins(v interface{}) int {
	arr := parseWinLoseList(v)
	w := 0
	for _, x := range arr {
		if f, ok := x.(float64); ok && (f == 1 || f == 2) {
			w++
		}
	}
	return w
}

// parseWinLoseList 把 result 字段值规整为 []any。
// PocketBase JSON 字段经 DB 读出后存为 types.JsonRaw（命名类型，底层 []byte），
// Go type switch 的 `case []byte:` 不匹配命名类型 → 旧实现漏匹配返回 nil → countWins=0 → delta=0 被拒。
// 故用 marshal→unmarshal 统一规整，覆盖 []any / []byte / string / types.JsonRaw 全形态。
func parseWinLoseList(v interface{}) []any {
	if v == nil {
		return nil
	}
	if arr, ok := v.([]any); ok {
		return arr
	}
	var b []byte
	switch val := v.(type) {
	case []byte:
		b = val
	case string:
		b = []byte(val)
	default:
		// types.JsonRaw 等命名类型走这里：json.Marshal 调其 MarshalJSON 拿到原始 JSON bytes。
		raw, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		b = raw
	}
	var arr []any
	if err := json.Unmarshal(b, &arr); err != nil {
		return nil
	}
	return arr
}

// writeLog 写一条 logs 审计记录（app.Save 绕过 API rules；logs 不可改不可删由 rule 兜底）。
func writeLog(app core.App, actor *core.Record, action, targetType, targetID string, detail map[string]any) error {
	logsCol, err := app.FindCollectionByNameOrId("logs")
	if err != nil {
		return err
	}
	l := core.NewRecord(logsCol)
	if actor != nil {
		l.Set("actor", actor.Id)
	}
	l.Set("action", action)
	l.Set("target_type", targetType)
	l.Set("target_id", targetID)
	l.Set("detail", detail)
	return app.Save(l)
}
