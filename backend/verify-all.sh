#!/usr/bin/env bash
# verify-all.sh — 集结杯 P5 后端 Phase 2/3/4-proof 全流程验证脚本
# 前置：PocketBase 已在 http://127.0.0.1:8090 运行，migrations 已建（5 集合 + users 锁），DB 干净。
# 自包含：创建 superuser + 3 accounts + 2 players，跑权限矩阵 + hook + 天梯 + sqlite 导出。
# 用 req() helper：body 写 /tmp/jjb_last.json，HTTP code 单独捕获（避免 -w 追加污染 JSON 解析）。
#
# 硬断言版（测试体系第①层）：原 print-and-eyeball 的 expect 注释 → 失败即 exit 1，让 CI 可红。
# 关键数值（hook delta=2.4 / 天梯 P1=9.8 P2=4.8）+ 权限矩阵（ALLOW/DENIED）全部走 assert。
set -u
cd /Users/bytedance/项目/jijiebei/backend || exit 1
BASE="http://127.0.0.1:8090"
CT="Content-Type: application/json"
get()  { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null; }
getr() { python3 -c "import sys,json;r=json.load(sys.stdin);print(r.get('record',{}).get('$1','') if isinstance(r.get('record'),dict) else '')" 2>/dev/null; }
req() { CODE=$(curl -s -o /tmp/jjb_last.json -w "%{http_code}" "$@"); BODY=$(cat /tmp/jjb_last.json); }
# json 取值（断言用，避免 inline 打印重复解析）
jget() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null; }

# ===== 硬断言层 =====
die() { echo "FATAL(assert): $*" >&2; exit 1; }
eq()  { [ "$1" = "$2" ] || die "expect=[$2] got=[$1] — $3"; }       # 字符串/HTTP code 相等
ne()  { [ "$1" != "$2" ] || die "expect≠[$2] got=[$1] — $3"; }      # 不等（DENIED: CODE≠200）
gt0() { [ "$1" -gt 0 ] 2>/dev/null || die "expect>0 got=[$1] — $2"; } # 正整数
eqf() { # 浮点容差（delta / total_delta，abs<1e-6 吸收 Go float64 乘法误差）
  python3 -c "import sys;sys.exit(0 if abs(float(sys.argv[1])-float(sys.argv[2]))<1e-6 else 1)" "$1" "$2" \
    || die "expect≈[$2] got=[$1] — $3"; }

echo "================ 0. health ================"
req "$BASE/api/health"
eq "$CODE" "200" "0.health 200"

echo "================ 1. create superuser (CLI) ================"
./pocketbase superuser upsert admin@jjb.test 'Admin123456!' 2>&1 | tail -2

echo "================ 2. superuser auth ================"
req -X POST "$BASE/api/collections/_superusers/auth-with-password" -H "$CT" \
  -d '{"identity":"admin@jjb.test","password":"Admin123456!"}'
SU_TOKEN=$(echo "$BODY" | get token)
echo "SU_TOKEN length=${#SU_TOKEN} (expect 223)"
eq "${#SU_TOKEN}" "223" "2.SU_TOKEN length=223"

echo "================ 3. create 3 accounts via superuser ================"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"admin@jjb.test","password":"Admin123456!","passwordConfirm":"Admin123456!","role":"admin","display_name":"管理员"}'
ADMIN_ID=$(echo "$BODY" | get id)
echo "admin: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"
eq "$(echo "$BODY" | get role)" "admin" "3.admin role=admin"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"host@jjb.test","password":"Host123456!","passwordConfirm":"Host123456!","role":"host","display_name":"主播土豆"}'
echo "host: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"
eq "$(echo "$BODY" | get role)" "host" "3.host role=host"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"viewer@jjb.test","password":"Viewer123456!","passwordConfirm":"Viewer123456!","role":"viewer","display_name":"观众"}'
echo "viewer: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"
eq "$(echo "$BODY" | get role)" "viewer" "3.viewer role=viewer"

echo "================ 4. auth 3 accounts ================"
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"admin@jjb.test","password":"Admin123456!"}'
ADM_TOKEN=$(echo "$BODY" | get token); ADM_ID=$(echo "$BODY" | getr id)
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"host@jjb.test","password":"Host123456!"}'
HOST_TOKEN=$(echo "$BODY" | get token); HOST_ID=$(echo "$BODY" | getr id)
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"viewer@jjb.test","password":"Viewer123456!"}'
VIEW_TOKEN=$(echo "$BODY" | get token)
echo "ADM=${#ADM_TOKEN} HOST=${#HOST_TOKEN} VIEW=${#VIEW_TOKEN} (expect 223) HOST_ID=$HOST_ID"
eq "${#ADM_TOKEN}" "223" "4.ADM token len=223"
eq "${#HOST_TOKEN}" "223" "4.HOST token len=223"
eq "${#VIEW_TOKEN}" "223" "4.VIEW token len=223"

echo "================ 5. create 2 players via admin ================"
req -X POST "$BASE/api/collections/players/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d '{"nickname":"选手甲","player_code":"P001","race_pref":"t","active":true}'
P1_ID=$(echo "$BODY" | get id)
req -X POST "$BASE/api/collections/players/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d '{"nickname":"选手乙","player_code":"P002","race_pref":"z","active":true}'
P2_ID=$(echo "$BODY" | get id)
echo "P1_ID=$P1_ID P2_ID=$P2_ID"
ne "$P1_ID" "" "5.P1_ID 非空"
ne "$P2_ID" "" "5.P2_ID 非空"

echo ""
echo "================ 6. PERMISSION MATRIX ================"
echo "--- 6a. host POST match (expect 200 ALLOWED, capture match id) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"match\",\"game_mode\":\"std12\",\"payload_code\":\"PERMTEST\",\"payload_ver\":1,\"players\":[\"$P1_ID\",\"$P2_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,2,0],\"score_total\":2}"
echo "HTTP $CODE | match id=$(echo "$BODY" | get id)"
M6A_ID=$(echo "$BODY" | get id)
eq "$CODE" "200" "6a.host POST match ALLOWED 200"
ne "$M6A_ID" "" "6a.match id 非空"

echo "--- 6b. viewer POST match (expect DENIED — not 200) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $VIEW_TOKEN" -H "$CT" \
  -d '{"mode":"match","game_mode":"std8","payload_code":"X","payload_ver":1,"result":[1,0,0]}'
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"
ne "$CODE" "200" "6b.viewer POST match DENIED (≠200)"

echo "--- 6c. host POST scores with VALID match (expect DENIED — scores admin-only) ---"
req -X POST "$BASE/api/collections/scores/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"player\":\"$P1_ID\",\"match\":\"$M6A_ID\",\"delta\":99,\"reason\":\"host-attempt\",\"season\":\"2026S1\"}"
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"
ne "$CODE" "200" "6c.host POST scores DENIED (≠200)"

echo "--- 6d. admin POST scores with VALID match (expect 200 ALLOWED — 契约 validation: admin 能改 scores) ---"
req -X POST "$BASE/api/collections/scores/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d "{\"player\":\"$P1_ID\",\"match\":\"$M6A_ID\",\"delta\":5,\"reason\":\"admin-manual-adjust\",\"season\":\"2026S1\"}"
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 250)"
eq "$CODE" "200" "6d.admin POST scores ALLOWED 200"

echo "--- 6e. admin PATCH logs (expect 403 DENIED — logs 不可改) ---"
req -X GET -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?perPage=1"
LID=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['items'][0]['id'] if d.get('items') else '')" 2>/dev/null)
echo "first log id=$LID"
req -X PATCH "$BASE/api/collections/logs/records/$LID" -H "Authorization: $ADM_TOKEN" -H "$CT" -d '{"action":"tampered"}'
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"
ne "$CODE" "200" "6e.admin PATCH logs DENIED (≠200, 不可改)"

echo "--- 6f. anon GET matches (expect 200 PUBLIC READ) ---"
req "$BASE/api/collections/matches/records?perPage=1"
echo "HTTP $CODE"
eq "$CODE" "200" "6f.anon GET matches PUBLIC 200"

echo "--- 6g. anon GET logs (expect 200 + empty) vs admin GET logs (expect 200 + items) ---"
req "$BASE/api/collections/logs/records?perPage=1"
ANON_LOG_ITEMS=$(echo "$BODY" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)
echo "[anon] HTTP $CODE | items: $ANON_LOG_ITEMS"
eq "$CODE" "200" "6g.anon GET logs 200"
eq "$ANON_LOG_ITEMS" "0" "6g.anon logs 应空（无权限）"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?perPage=3"
ADM_LOG_ITEMS=$(echo "$BODY" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)
echo "[admin] HTTP $CODE | items: $ADM_LOG_ITEMS"
eq "$CODE" "200" "6g.admin GET logs 200"
gt0 "$ADM_LOG_ITEMS" "6g.admin logs 应有 items"

echo ""
echo "================ 7. HOOK TEST ================"
echo "--- 7a. POST match mode=match result=[1,2,0] std12 → expect 200 + hook derives 2 scores delta=2.4 ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"match\",\"game_mode\":\"std12\",\"payload_code\":\"HOOK1\",\"payload_ver\":1,\"players\":[\"$P1_ID\",\"$P2_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,2,0],\"score_total\":2}"
echo "HTTP $CODE | match id=$(echo "$BODY" | get id)"
MHK_ID=$(echo "$BODY" | get id)
eq "$CODE" "200" "7a.host POST hook match 200"
sleep 0.3
echo "--- 7b. GET scores filter match=MHK_ID (expect 2 items, delta=2.4 each) ---"
req "$BASE/api/collections/scores/records?filter=(match='$MHK_ID')"
SCORES_TOTAL=$(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)
SCORES_DELTAS=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(','.join(str(it.get('delta')) for it in d.get('items',[])))
" 2>/dev/null)
echo "HTTP $CODE | totalItems=$SCORES_TOTAL | deltas=$SCORES_DELTAS"
eq "$SCORES_TOTAL" "2" "7b.hook 派生 2 条 scores"
for d in $(echo "$SCORES_DELTAS" | tr ',' ' '); do eqf "$d" "2.4" "7b.score delta≈2.4 (2 wins × std12 coef 1.2)"; done

echo "--- 7c. GET logs action=score.adjust + match.create (admin, expect both) ---"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?filter=(action='score.adjust')"
ADJ_TOTAL=$(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)
echo "score.adjust totalItems: $ADJ_TOTAL"
gt0 "$ADJ_TOTAL" "7c.score.adjust log 应≥1"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?filter=(action='match.create')"
CREATE_TOTAL=$(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)
echo "match.create totalItems: $CREATE_TOTAL"
gt0 "$CREATE_TOTAL" "7c.match.create log 应≥1"

echo "--- 7d. POST match mode=practice (expect 200, NO scores derived) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"practice\",\"game_mode\":\"std8\",\"payload_code\":\"PRAC1\",\"payload_ver\":1,\"players\":[\"$P1_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,0,0],\"score_total\":1}"
echo "HTTP $CODE | practice match id=$(echo "$BODY" | get id)"
PRAC_ID=$(echo "$BODY" | get id)
eq "$CODE" "200" "7d.practice POST 200"
sleep 0.3
echo "--- 7e. GET scores filter match=PRAC_ID (expect 0 items) ---"
req "$BASE/api/collections/scores/records?filter=(match='$PRAC_ID')"
PRAC_SCORES=$(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)
echo "HTTP $CODE | totalItems: $PRAC_SCORES"
eq "$PRAC_SCORES" "0" "7e.practice 不派生 scores"

echo ""
echo "================ 8. RANKINGS ================"
echo "expect: P1 = 2.4(6a-hook) + 5(6d-admin) + 2.4(7a-hook) = 9.8 ; P2 = 2.4(6a) + 2.4(7a) = 4.8"
req "$BASE/api/rankings"
P1_DELTA=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((r.get('total_delta') for r in d.get('rankings',[]) if r.get('player_code')=='P001'),0))" 2>/dev/null)
P2_DELTA=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((r.get('total_delta') for r in d.get('rankings',[]) if r.get('player_code')=='P002'),0))" 2>/dev/null)
echo "HTTP $CODE | $(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('season=',d.get('season'),'count=',d.get('count'))
for r in d.get('rankings',[]):
    print('  ',r.get('nickname'),r.get('player_code'),'total_delta=',r.get('total_delta'),'score_count=',r.get('match_count'))
" 2>/dev/null)"
eqf "$P1_DELTA" "9.8" "8.P1(P001) total_delta=9.8"
eqf "$P2_DELTA" "4.8" "8.P2(P002) total_delta=4.8"

echo "================ 9. SCORING config ================"
req "$BASE/api/scoring"
echo "HTTP $CODE | $(echo "$BODY" | head -c 300)"
eq "$CODE" "200" "9.scoring GET 200"

echo "================ 10. SQLite export (data.db + wal + shm) ================"
cp pb_data/data.db /tmp/jjb-export.db
cp pb_data/data.db-wal /tmp/jjb-export.db-wal 2>/dev/null || echo "(no wal)"
cp pb_data/data.db-shm /tmp/jjb-export.db-shm 2>/dev/null || true
echo "copied to /tmp/jjb-export.db{,-wal,-shm}"
sqlite3 /tmp/jjb-export.db ".tables"
echo "--- row counts ---"
sqlite3 /tmp/jjb-export.db "SELECT 'matches', COUNT(*) FROM matches UNION ALL SELECT 'scores', COUNT(*) FROM scores UNION ALL SELECT 'logs', COUNT(*) FROM logs UNION ALL SELECT 'players', COUNT(*) FROM players UNION ALL SELECT 'accounts', COUNT(*) FROM accounts;"

echo "================ DONE (all asserts passed) ================"
