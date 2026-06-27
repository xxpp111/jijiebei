// pb_migrations/1782000005_player_accounts.go — 新建 player_accounts auth 集合（选手自助注册/登录）。
//
// player_accounts：选手注册/登录体系，与 accounts（admin/host 运营集合）解耦。
//   选手自助注册建档案（昵称/手机号/密码 + 选填 社交/擅长指挥官），phone 作唯一身份。
//   字段：nickname(text required max40) / phone(text·unique·idx_pa_phone) / social(json)
//         fav_commanders(json，存中文名数组) / player(relation→players MaxSelect=1)
//         + created/updated autodate
//
// identity 方案（契约 stop_when 兜底）：PB 0.39 auth-with-password 的 identity 匹配 email/username，
//   phone 非原生 identity。用 phone 兼写 email 兜底（{phone}@phone.jjb）作 PB identity 容器，
//   phone 真值存自定义 phone 字段（unique）。映射在前端 backend.ts registerPlayer/pbAuthPlayer 内部完成。
//   故本集合内置 email 字段不作为选手联系邮箱，仅作 identity 容器（emailVisibility 默认 false 不暴露）。
//
// API Rules（对齐 jjb-features-blueprint 决策）：
//   listRule / viewRule / updateRule = '@request.auth.id = id' → 选手只看/改自己档案
//   createRule = "" → 选手自助注册
//   deleteRule = '@request.auth.role = 'admin'' → admin-only
//     （跨集合：player_accounts 自己的 record 无 role 字段 → 表达式 false；accounts admin token → true）
//
// 幂等：FindCollectionByNameOrId 已有则跳过，不破坏已有数据。
// down：删除 player_accounts 集合（rm pb_data && migrate up 可重放）。
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(
		func(app core.App) error {
			if _, err := app.FindCollectionByNameOrId("player_accounts"); err == nil {
				return nil // 幂等：已有则跳过
			}

			playersCol, err := app.FindCollectionByNameOrId("players")
			if err != nil {
				return err
			}

			col := core.NewAuthCollection("player_accounts")
			col.Fields.Add(
				&core.TextField{Name: "nickname", Required: true, Max: 40},
				&core.TextField{Name: "phone", Required: true, Max: 20},
				&core.JSONField{Name: "social", Required: false},
				&core.JSONField{Name: "fav_commanders", Required: false}, // 存中文名数组
				&core.RelationField{Name: "player", CollectionId: playersCol.Id, MaxSelect: 1},

				// autodate：PB 0.39 initDefaultFields 只加 id + auth 字段（password/tokenKey/email/...），
				// 不加 created/updated —— 必须显式加，否则按 -updated/-created 排序的查询恒报错（教训见需求2 B1）。
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)

			col.ListRule = types.Pointer("@request.auth.id = id")
			col.ViewRule = types.Pointer("@request.auth.id = id")
			col.CreateRule = types.Pointer("")                       // 选手自助注册
			col.UpdateRule = types.Pointer("@request.auth.id = id")  // 选手改自己档案
			col.DeleteRule = types.Pointer("@request.auth.role = 'admin'")

			col.AddIndex("idx_pa_phone", true, "phone", "") // phone unique（唯一身份）

			return app.Save(col)
		},
		func(app core.App) error {
			col, err := app.FindCollectionByNameOrId("player_accounts")
			if err != nil {
				return nil
			}
			return app.Delete(col)
		},
	)
}
