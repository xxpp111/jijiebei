package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

const accountsUpdateRuleImmutableRoleAndPotato = "(@request.auth.id = id && @request.body.role:changed = false && @request.body.potato_ai_bias:changed = false) || @request.auth.role = 'admin'"

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("accounts")
			if err != nil {
				return nil
			}
			if col.Fields.GetByName("potato_ai_bias") == nil {
				col.Fields.Add(&core.BoolField{Name: "potato_ai_bias"})
			}
			if col.UpdateRule != nil && *col.UpdateRule == accountsUpdateRuleImmutableRoleAndPotato {
				return app.Save(col)
			}
			col.UpdateRule = types.Pointer(accountsUpdateRuleImmutableRoleAndPotato)
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("accounts")
			if err != nil {
				return nil
			}
			col.Fields.RemoveByName("potato_ai_bias")
			col.UpdateRule = types.Pointer(accountsUpdateRuleImmutableRole)
			return app.Save(col)
		},
	)
}
