// pb_migrations/1782000003_scores_wins_games.go — scores 加 wins+games 结构化战绩字段。
//
// 背景：原 scores 仅存 delta（积分增量），天梯 rankingsHandler 用 COUNT(s.id)=match_count 占位"赛季对局"
//   ——但 match_count 是"记分对局数"非"总局数/胜场"，无法表达「胜/总」战绩。件1 天梯战绩真实化：
//   每条 score 额外存 wins（本局该选手获胜场，v==1||v==2）+ games（本局总局数 = len(winLoseList)），
//   rankingsHandler 改 SUM(wins)/SUM(games) 返 total_wins/total_games，前端 LadderScreen 显「胜/总」。
//
// 幂等：用 FindCollectionByNameOrId + 字段名判存（FieldByName），已有则跳过，不破坏旧记录（旧记录 wins/games 为 nil，
//   rankingsHandler COALESCE(SUM(wins),0) 兜底 0，旧数据仍可用 delta 积分，战绩列旧选手显 0/0 不报错）。
//   不动 delta/reason/season 旧字段，不改旧 migration（1782000001 不动）。
//
// down：移除 wins/games 两字段（FieldByName 找到则 Delete，找不到跳过）。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("scores")
			if err != nil {
				return nil // scores 集合不存在（未跑 init_collections）→ no-op，不阻塞
			}
			// wins：本局该选手获胜场（hook 从 match.result 算 v==1||v==2 计数，对齐 countWins）
			if col.Fields.GetByName("wins") == nil {
				col.Fields.Add(&core.NumberField{Name: "wins"})
			}
			// games：本局总局数（= len(winLoseList)，通常 3 场 BO3）
			if col.Fields.GetByName("games") == nil {
				col.Fields.Add(&core.NumberField{Name: "games"})
			}
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("scores")
			if err != nil {
				return nil
			}
			col.Fields.RemoveByName("wins")
			col.Fields.RemoveByName("games")
			return app.Save(col)
		},
	)
}
