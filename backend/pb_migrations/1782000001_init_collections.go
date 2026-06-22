// pb_migrations/1782000001_init_collections.go — 集结杯 P5 后端 5 集合 schema 初始化。
//
// 5 集合（按 relation 依赖序创建）：accounts(auth) → players → matches → scores → logs。
//   accounts: auth 集合（内置 email/password/verified/tokenKey + 自定义 role/display_name）。
//   players:  选手实体（被展示/计分，与主播解耦）。
//   matches:  对局（mode=practice/match 分流，game_mode 直存 SessionMode，payload_code 单字段存整局）。
//   scores:   积分（hook 用 app.Save 绕过 rules 写，前端不直接 POST）。
//   logs:     审计（updateRule/deleteRule=nil 不可改删）。
//
// API Rules 矩阵（对齐 research-backend-p5 §1.6）：
//   players/matches/scores 读公开("")；matches 写 host||admin；scores 全 admin-only(nil)；
//   logs 读 admin-only + 不可改删(nil)；accounts 读/写 admin-only（update 可改自己）。
//
// down: 逆序删 5 集合（rm pb_data && migrate up 可从零重放）。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error { return createAllCollections(app) },
		func(app core.App) error { return dropAllCollections(app) },
	)
}

func createAllCollections(app core.App) error {
	// 1. accounts（auth，先建：matches.host / logs.actor 指向它）
	accounts := core.NewAuthCollection("accounts")
	accounts.Fields.Add(
		&core.SelectField{Name: "role", Required: true, Presentable: true, Values: []string{"admin", "host", "viewer"}, MaxSelect: 1},
		&core.TextField{Name: "display_name", Required: true, Max: 100},
	)
	accounts.ListRule = types.Pointer("@request.auth.role = 'admin'")
	accounts.ViewRule = types.Pointer("@request.auth.role = 'admin'")
	accounts.CreateRule = types.Pointer("@request.auth.role = 'admin'") // 不开放自助注册
	accounts.UpdateRule = types.Pointer("@request.auth.id = id || @request.auth.role = 'admin'")
	accounts.DeleteRule = types.Pointer("@request.auth.role = 'admin'")
	if err := app.Save(accounts); err != nil {
		return err
	}

	// 2. players（选手实体）
	players := core.NewCollection("base", "players")
	players.Fields.Add(
		&core.TextField{Name: "nickname", Required: true, Max: 40},
		&core.TextField{Name: "player_code", Required: true, Max: 64}, // 报名号/工会号，稳定锚（昵称可改 code 不可改）
		&core.SelectField{Name: "race_pref", Presentable: true, Values: []string{"t", "z", "p"}, MaxSelect: 1}, // 主玩种族 t/z/p
		&core.FileField{Name: "avatar", MaxSelect: 1},                                                          // 头像（PocketBase 文件字段；不传前端用族徽占位）
		&core.BoolField{Name: "active"},                                                                        // 是否在役（天梯过滤）
		&core.TextField{Name: "notes"},
	)
	players.ListRule = types.Pointer("")                                                                      // 公开读（直播展示需匿名可读）
	players.ViewRule = types.Pointer("")
	players.CreateRule = types.Pointer("@request.auth.role = 'host' || @request.auth.role = 'admin'")
	players.UpdateRule = types.Pointer("@request.auth.role = 'host' || @request.auth.role = 'admin'")
	players.DeleteRule = types.Pointer("@request.auth.role = 'admin'")
	players.AddIndex("idx_players_player_code", true, "player_code", "") // unique
	if err := app.Save(players); err != nil {
		return err
	}

	// 3. matches（对局，比赛+练习共用，mode 分流）
	matches := core.NewCollection("base", "matches")
	matches.Fields.Add(
		&core.SelectField{Name: "mode", Required: true, Presentable: true, Values: []string{"practice", "match"}, MaxSelect: 1},
		&core.TextField{Name: "game_mode", Required: true, Max: 32}, // 直存 live SessionMode 字符串（11 枚举）
		&core.TextField{Name: "payload_code", Required: true, Max: 2048}, // 整局索引码（与 P3 codec 同一编码器；max 2048 容纳 codec 自包含码实测≤858 + URL #hash 上限~2000 余量）
		&core.NumberField{Name: "payload_ver", Required: true},          // 码 schema 版本号
		&core.RelationField{Name: "players", CollectionId: players.Id, MaxSelect: 20}, // 参与选手（双打 2 人，留余量）
		&core.RelationField{Name: "host", CollectionId: accounts.Id, MaxSelect: 1},    // 主持主播（practice 可空）
		&core.JSONField{Name: "result"},          // 直存 live winLoseList [0|1|2,...]
		&core.NumberField{Name: "score_total"},   // 获胜场 = getScore()（前端传，hook 从 result 复算不依赖）
		&core.JSONField{Name: "bp_config"},       // 本局 BP 规则快照
		&core.DateField{Name: "started_at"},
		&core.DateField{Name: "ended_at"},
	)
	matches.ListRule = types.Pointer("") // 公开读（观众/直播）
	matches.ViewRule = types.Pointer("")
	matches.CreateRule = types.Pointer("@request.auth.role = 'host' || @request.auth.role = 'admin'")
	matches.UpdateRule = types.Pointer("@request.auth.id = host || @request.auth.role = 'admin'") // 仅本人主持的局或 admin
	matches.DeleteRule = types.Pointer("@request.auth.role = 'admin'")
	matches.AddIndex("idx_matches_mode", false, "mode", "")
	matches.AddIndex("idx_matches_game_mode", false, "game_mode", "")
	if err := app.Save(matches); err != nil {
		return err
	}

	// 4. scores（积分，hook 用 app.Save 绕过 rules 写 — 前端不直接 POST）
	scores := core.NewCollection("base", "scores")
	scores.Fields.Add(
		&core.RelationField{Name: "player", Required: true, CollectionId: players.Id, MaxSelect: 1, CascadeDelete: true},
		&core.RelationField{Name: "match", Required: true, CollectionId: matches.Id, MaxSelect: 1, CascadeDelete: true},
		&core.NumberField{Name: "delta", Required: true}, // 本局得分增量（hook 算）
		&core.TextField{Name: "reason"},                  // 计分依据（wins/coef/season，可追溯）
		&core.TextField{Name: "season", Required: true},  // 赛季标识（天梯分赛季聚合键）
	)
	scores.ListRule = types.Pointer("") // 公开读（天梯展示）
	scores.ViewRule = types.Pointer("")
	scores.CreateRule = types.Pointer("@request.auth.role = 'admin'") // admin-only（hook 用 app.Save 绕过规则写；host/viewer 不可写，admin 可修正）
	scores.UpdateRule = types.Pointer("@request.auth.role = 'admin'") // admin-only（契约 validation: admin 能改 scores）
	scores.DeleteRule = types.Pointer("@request.auth.role = 'admin'") // admin-only（admin 可删错误积分；research-backend-p5 §1.6 矩阵）
	scores.AddIndex("idx_scores_season", false, "season", "")
	scores.AddIndex("idx_scores_player_season", false, "player, season", "")
	if err := app.Save(scores); err != nil {
		return err
	}

	// 5. logs（审计，不可改不可删）
	logs := core.NewCollection("base", "logs")
	logs.Fields.Add(
		&core.RelationField{Name: "actor", CollectionId: accounts.Id, MaxSelect: 1}, // 操作者（系统事件可空）
		&core.TextField{Name: "action", Required: true},                            // 事件类型 match.create/score.adjust/...
		&core.TextField{Name: "target_type"},
		&core.TextField{Name: "target_id"},
		&core.JSONField{Name: "detail"}, // 结构化上下文（前后值 diff 等）
		&core.TextField{Name: "ip"},
	)
	logs.ListRule = types.Pointer("@request.auth.role = 'admin'") // 审计仅 admin 可读
	logs.ViewRule = types.Pointer("@request.auth.role = 'admin'")
	logs.CreateRule = nil // hook 写（app.Save 绕过）
	logs.UpdateRule = nil // 不可改（审计完整性）
	logs.DeleteRule = nil // 不可删
	logs.AddIndex("idx_logs_action", false, "action", "")
	if err := app.Save(logs); err != nil {
		return err
	}

	return nil
}

func dropAllCollections(app core.App) error {
	// 逆序删（先删依赖方）
	for _, name := range []string{"logs", "scores", "matches", "players", "accounts"} {
		if col, err := app.FindCollectionByNameOrId(name); err == nil {
			if err := app.Delete(col); err != nil {
				return err
			}
		}
	}
	return nil
}
