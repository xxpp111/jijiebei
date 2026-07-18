// pb_migrations/1782000009_matches_practice_ownership.go — Round S 安全止血 · 漏洞2：practice 归属 fail-closed。
//
// 背景（漏洞）：1782000006 放开 practice 落库时
//   CreateRule practice 分支 = "@request.body.mode = 'practice' && @request.auth.id != ''"
//   只校验「登录态」，不校验 players 归属 —— 任何登录 token（含选手 player_accounts）落 practice 时，
//   players 字段可指向任意他人 / 空 / 伪双打（隔离 PB 实测 HEAD 5586082：players=[他人]/[]/[A,B] 全返200）。
//   危害：matches 公开读 → 污染他人练习战绩 / 直播展示、伪造对局归属。
//
// 修复：practice 分支追加「players 只能是本人绑定 player」约束（match 分支不变）。
//   CreateRule practice 分支 = "... && @request.auth.id != '' && @request.body.players:each = @request.auth.player"
//   PB0.39 :each 修饰符 = 列表每个元素都必须满足该比较；语义：
//     · players=[本人绑定 player]      → 满足 → 放行（前端 ensurePlayer()→player_accounts.player 正是本人绑定，合法流程不回归）
//     · players=[他人]                 → 不满足 → 拒绝
//     · players=[]（空）               → :each 对空列表恒 false → 拒绝（fail-closed 空归属）
//     · players=[本人,他人] 伪双打      → 含非本人 → 拒绝
//   @request.auth.player：player_accounts 的 player relation（注册 hook 自动建 players 并回填，MaxSelect=1）。
//   match 分支仍 host||admin：host/admin 的正式 match players 是任意选手，走 role 分支不受本约束（正式赛不回归）。
//   隔离 PB 实测（候选 C2）：own[A]=200 / other[B]=400 / empty=400 / fake2[A,B]=400 / hostMatch=200，全部符合。
//
// 幂等：读当前 rule，已是修复值则跳过；否则写。不改既有 migration（1782000006 不动）、不碰 pb_data。
// down：恢复 1782000006 的 practice 放开 rule（未加归属约束的版本）。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// practice 分支追加 players:each = @request.auth.player 归属约束；match 分支与 1782000006 一致。
const matchesCreateRuleOwnership = "(@request.body.mode = 'match' && (@request.auth.role = 'host' || @request.auth.role = 'admin')) || (@request.body.mode = 'practice' && @request.auth.id != '' && @request.body.players:each = @request.auth.player)"

// 1782000006 的 practice 放开 rule（未加归属约束，down 回滚目标）。
const matchesCreateRulePracticeOpen = "(@request.body.mode = 'match' && (@request.auth.role = 'host' || @request.auth.role = 'admin')) || (@request.body.mode = 'practice' && @request.auth.id != '')"

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return nil // matches 集合不存在（未跑 init_collections）→ no-op，不阻塞
			}
			if col.CreateRule != nil && *col.CreateRule == matchesCreateRuleOwnership {
				return nil // 幂等：已是修复值
			}
			col.CreateRule = types.Pointer(matchesCreateRuleOwnership)
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return nil
			}
			col.CreateRule = types.Pointer(matchesCreateRulePracticeOpen)
			return app.Save(col)
		},
	)
}
