// hooks_test: 积分 hook 纯函数回归（测试体系第①层 · backend）。
// 被测：backend/hooks.go countWins + parseWinLoseList。
// 最高价值：parseWinLoseList 四形态覆盖（[]any / []byte / string / types.JSONRaw）——
//   types.JsonRaw 是命名类型（type JSONRaw []byte），Go type switch 的 `case []byte` 不匹配命名类型，
//   旧实现漏匹配返回 nil → countWins=0 → delta=0 → 选手分被吞。这是已修 bug 的回归网。
package main

import (
	"reflect"
	"testing"

	"github.com/pocketbase/pocketbase/tools/types"
)

func TestCountWins(t *testing.T) {
	cases := []struct {
		name string
		in   interface{}
		want int
	}{
		{"空 nil", nil, 0},
		{"全输 [0,0,0]", []any{float64(0), float64(0), float64(0)}, 0},
		{"全胜 [1,1,1]", []any{float64(1), float64(1), float64(1)}, 3},
		{"含 bonus [1,2,0] → 2 胜（v==1||v==2 计胜，不双计）", []any{float64(1), float64(2), float64(0)}, 2},
		{"纯 bonus [2,2] → 2 胜", []any{float64(2), float64(2)}, 2},
		{"[]byte 真实 DB 形态 [2,2,1] → 3 胜", []byte("[2,2,1]"), 3},
		{"types.JSONRaw 真实 DB 形态 [1,2,1] → 3 胜", types.JSONRaw("[1,2,1]"), 3},
	}
	for _, c := range cases {
		if got := countWins(c.in); got != c.want {
			t.Errorf("countWins(%s)=%d, want %d", c.name, got, c.want)
		}
	}
}

func TestParseWinLoseListFourShapes(t *testing.T) {
	want := []any{float64(1), float64(2), float64(0)}
	// 四形态均规整为 []any{float64...}。types.JSONRaw 是命名类型 → 走 default 分支 json.Marshal→MarshalJSON 拿原 bytes。
	shapes := []struct {
		name string
		in   interface{}
	}{
		{"[]any 直通", []any{float64(1), float64(2), float64(0)}},
		{"[]byte", []byte("[1,2,0]")},
		{"string", "[1,2,0]"},
		{"types.JSONRaw（命名类型，已修 bug 回归点）", types.JSONRaw("[1,2,0]")},
	}
	for _, s := range shapes {
		got := parseWinLoseList(s.in)
		if !reflect.DeepEqual(got, want) {
			t.Errorf("parseWinLoseList(%s)=%#v, want %#v", s.name, got, want)
		}
	}
}

func TestParseWinLoseListNilAndGarbage(t *testing.T) {
	if parseWinLoseList(nil) != nil {
		t.Error("parseWinLoseList(nil) 应返回 nil")
	}
	if parseWinLoseList([]byte("not-json")) != nil {
		t.Error("parseWinLoseList(非法 json) 应返回 nil")
	}
}
