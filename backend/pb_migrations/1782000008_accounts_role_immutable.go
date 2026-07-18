// pb_migrations/1782000008_accounts_role_immutable.go — Round S 安全止血 · 漏洞1：accounts.role 字段级不可变。
//
// 背景（漏洞）：1782000001 建 accounts 时
//   UpdateRule = "@request.auth.id = id || @request.auth.role = 'admin'"
//   只校验「本人或 admin」，无字段级限制 —— 任何 host/viewer 账号可 PATCH 自己的 record 把 role 改成 admin，
//   单次请求完成 viewer/host → admin 全量提权（隔离 PB 实测 HEAD 5586082 返 200 提权成功）。
//
// 修复：用 PB 0.39 内建 :changed 修饰符做字段级不可变。
//   UpdateRule = "(@request.auth.id = id && @request.body.role:changed = false) || @request.auth.role = 'admin'"
//   PB 把 role:changed 展开为「@request.body.role:isset = true && @request.body.role != <当前值>」
//   （见 pocketbase@v0.39.4/core/record_field_resolver_runner.go processRequestBodyChangedModifier）：
//     · 本人 PATCH 不带 role 字段        → :changed=false → 放行（改 display_name 等非 role 字段不受影响）
//     · 本人 PATCH role=当前值（未变）   → :changed=false → 放行（幂等回写不误伤）
//     · 本人 PATCH role=新值（提权）     → :changed=true  → 拒绝（提权被拦）
//     · admin                            → 走第二分支，任意角色管理照常
//   隔离 PB 实测：viewer 自提权→404 拦 / 改名→200 放行 / admin 改他人 role→200 保留。
//
// 幂等：读当前 rule，已是修复值则跳过；否则写。不改既有 migration、不碰 pb_data。
// down：恢复 1782000001 的原始 UpdateRule 字面量。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

const accountsUpdateRuleImmutableRole = "(@request.auth.id = id && @request.body.role:changed = false) || @request.auth.role = 'admin'"
const accountsUpdateRuleOriginal = "@request.auth.id = id || @request.auth.role = 'admin'"

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("accounts")
			if err != nil {
				return nil // accounts 集合不存在（未跑 init_collections）→ no-op，不阻塞
			}
			if col.UpdateRule != nil && *col.UpdateRule == accountsUpdateRuleImmutableRole {
				return nil // 幂等：已是修复值
			}
			col.UpdateRule = types.Pointer(accountsUpdateRuleImmutableRole)
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("accounts")
			if err != nil {
				return nil
			}
			col.UpdateRule = types.Pointer(accountsUpdateRuleOriginal)
			return app.Save(col)
		},
	)
}
