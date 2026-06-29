// pb_migrations/1782000006_matches_practice_rule.go — 放开 matches.CreateRule 让选手自助落 practice 局（需求1 阶段4）。
//
// 现状（1782000001）：matches.CreateRule = host||admin → 选手 player_accounts token（无 role）落不了任何局。
// 改：
//   match 局   仍限 host||admin（进正式天梯，scores hook 派生积分）；
//   practice 局 放开给任何登录态（player_accounts 选手 token 也可），mode=practice 的 scores hook 按 mode 跳过算分
//              （练习战绩选手自存、不进正式天梯）。
//   @request.body.mode = 创建时 POST body 的 mode 字段；@request.auth.role 仅 accounts 有（player_accounts 无 → match 分支天然 false）。
// down：回滚到仅 host||admin。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

const matchesCreateRulePractice = "(@request.body.mode = 'match' && (@request.auth.role = 'host' || @request.auth.role = 'admin')) || (@request.body.mode = 'practice' && @request.auth.id != '')"
const matchesCreateRuleHostOnly = "@request.auth.role = 'host' || @request.auth.role = 'admin'"

func init() {
	m.Register(
		func(app core.App) error {
			matches, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return err
			}
			matches.CreateRule = types.Pointer(matchesCreateRulePractice)
			return app.Save(matches)
		},
		func(app core.App) error {
			matches, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return nil
			}
			matches.CreateRule = types.Pointer(matchesCreateRuleHostOnly)
			return app.Save(matches)
		},
	)
}
