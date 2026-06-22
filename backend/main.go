// Package main: 集结杯比赛平台 PocketBase 后端入口（Go embed，v0.39.4）。
//
// 5 集合 schema 由 pb_migrations/ 定义（players/matches/scores/logs/accounts）；
// 积分/天梯/审计 hook 见 hooks.go；天梯聚合 + 系数读取路由见 routes.go；
// 积分系数表 config/scoring.json 配置化（不硬编码进 hook）。
//
// 前端对接形状（web/src 仅只读，本 round 不改前端）：matches POST payload 直存 live
// SessionMode 字符串 / winLoseList / getScore() — schema 与 live 同形，见 README 映射表。
package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	_ "jjb-backend/pb_migrations" // 注册 migrations（init() 调 m.Register）
)

func main() {
	app := pocketbase.New()

	// 注册 migrate 子命令（pocketbase migrate up/down/create）。
	// Go migrations 编译进二进制（pb_migrations/*.go 的 init 注册），serve 时自动跑未应用的迁移。
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangGo,
		Automigrate:  false,
	})

	// 加载积分系数表（配置化：改 config/scoring.json 重启即生效，不重编译 Go）。
	// 非致命：migrate up/create 等维护命令不应因系数表缺失而崩；serve 时若缺失用默认系数 1.0 + 日志 warning。
	if err := loadScoring(scoringConfigPath()); err != nil {
		log.Printf("[jjb] WARNING: load scoring config failed (%v) — using default coefficient 1.0", err)
	}

	registerHooks(app)   // 积分计算 + 审计埋点
	registerRoutes(app)  // /api/rankings 天梯聚合 + /api/scoring 系数读取

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// scoringConfigPath: 系数表路径，env JJB_SCORING_CONFIG 可覆盖（默认 config/scoring.json）。
func scoringConfigPath() string {
	if p := os.Getenv("JJB_SCORING_CONFIG"); p != "" {
		return p
	}
	return "config/scoring.json"
}
