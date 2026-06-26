// pb_migrations/1782000004_event_rules.go — 新建 event_rules 集合（赛事 ban 规则）。
//
// event_rules：主播线上配置赛事 ban，对单打/双打三引擎统一生效，不发版改规则。
//   字段：season(text) / ban_maps(json) / ban_factors(json) / ban_mutators(json)
//         active(bool 单活跃) / note(text) / updated_by(text 记操作人)
//
// Rules（对齐 1782000001 格式）：
//   listRule / viewRule = "" → 公开可读（前端开局拉 /api/event-rules，无登录观众也可）
//   createRule / updateRule = @request.auth.role = 'host' || @request.auth.role = 'admin'
//   deleteRule = @request.auth.role = 'admin'
//
// 幂等：FindCollectionByNameOrId 已有则跳过，不破坏已有数据。
// down：删除整个 event_rules 集合。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(
		func(app core.App) error {
			if _, err := app.FindCollectionByNameOrId("event_rules"); err == nil {
				return nil // 幂等：已有则跳过
			}

			col := core.NewBaseCollection("event_rules")

			col.Fields.Add(&core.TextField{Name: "season", Required: false})
			col.Fields.Add(&core.JSONField{Name: "ban_maps", Required: false})
			col.Fields.Add(&core.JSONField{Name: "ban_factors", Required: false})
			col.Fields.Add(&core.JSONField{Name: "ban_mutators", Required: false})
			col.Fields.Add(&core.BoolField{Name: "active"})
			col.Fields.Add(&core.TextField{Name: "note", Required: false})
			col.Fields.Add(&core.TextField{Name: "updated_by", Required: false})

			col.ListRule = types.Pointer("")  // 公开可读
			col.ViewRule = types.Pointer("")
			col.CreateRule = types.Pointer("@request.auth.role = 'host' || @request.auth.role = 'admin'")
			col.UpdateRule = types.Pointer("@request.auth.role = 'host' || @request.auth.role = 'admin'")
			col.DeleteRule = types.Pointer("@request.auth.role = 'admin'")

			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("event_rules")
			if err != nil {
				return nil
			}
			return app.Delete(col)
		},
	)
}
