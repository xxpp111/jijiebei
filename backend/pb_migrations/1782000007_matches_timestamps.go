// pb_migrations/1782000007_matches_timestamps.go — matches 加 created/updated autodate 字段。
//
// 背景：matches 从建库(1782000001)至今没有任何时间戳字段；bp_config/started_at/ended_at 三个
//   schema 字段定义了但前端从未写入，实际唯一可能的"何时发生"来源只有 PB 内部 rowid 顺序，不可查询。
//   admin/src/pages/Matches.tsx 拉列表时硬编码 sort=-created，PB 0.39 校验排序字段必须存在于 schema，
//   matches 没有 created 字段 → 每次请求直接 400（"Something went wrong while processing your request."），
//   界面把这个错误吞成"暂无数据"，误导成"没人打过比赛"，实际库里已有真实对局记录（2026-07-02 生产环境实测发现）。
//
// 仿 1782000005(player_accounts) 同款 AutodateField 声明；仿 1782000003(scores) 同款
//   FieldByName 判存幂等写法，防重跑破坏已有数据。
//
// down：移除 created/updated 两字段。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return nil // matches 集合不存在（未跑 init_collections）→ no-op，不阻塞
			}
			if col.Fields.GetByName("created") == nil {
				col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
			}
			if col.Fields.GetByName("updated") == nil {
				col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})
			}
			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("matches")
			if err != nil {
				return nil
			}
			col.Fields.RemoveByName("created")
			col.Fields.RemoveByName("updated")
			return app.Save(col)
		},
	)
}
