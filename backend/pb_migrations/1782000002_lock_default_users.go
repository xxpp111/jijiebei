// pb_migrations/1782000002_lock_default_users.go — 锁掉 PocketBase v0.39.4 默认 `users` auth 集合。
//
// 背景：migrate up 后 PocketBase 会自带一个默认 `users` auth 集合（与本应用的 `accounts` 并存），
//   其 createRule="" 即开放自助注册。本应用所有认证走 `accounts`（role=admin/host/viewer），
//   `users` 不被使用。开放注册虽无 role 字段、无法满足 host/admin 规则（无越权风险），
//   但与「accounts 不开放自助注册」的安全姿态不一致，且留有垃圾账号注册面。
//   故锁掉 `users` 的 createRule/updateRule 为 NULL（API 不可建/不可改，仅 admin/superuser dao 可写）。
//
// graceful no-op：若未来 PocketBase 移除默认 `users` 集合，FindCollectionByNameOrId 返回 err → 跳过（不报错）。
//
// down：恢复 PocketBase 默认规则（create="" 开放、update="id = @request.auth.id" 自改）。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				return nil // users 默认集合不存在（未来 PB 移除）→ no-op
			}
			col.CreateRule = nil // 禁止 API 自助注册
			col.UpdateRule = nil // 禁止 API 自改（应用不用 users，无影响）
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				return nil
			}
			empty := ""
			col.CreateRule = &empty                                  // 恢复 PB 默认开放注册
			col.UpdateRule = types.Pointer("id = @request.auth.id") // 恢复自改
			return app.Save(col)
		},
	)
}
