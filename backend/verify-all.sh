#!/usr/bin/env bash
# verify-all.sh — 集结杯 P5 后端 Phase 2/3/4-proof 全流程验证脚本
# 前置：PocketBase 已在 http://127.0.0.1:8090 运行，migrations 已建（5 集合 + users 锁），DB 干净。
# 自包含：创建 superuser + 3 accounts + 2 players，跑权限矩阵 + hook + 天梯 + sqlite 导出。
# 用 req() helper：body 写 /tmp/jjb_last.json，HTTP code 单独捕获（避免 -w 追加污染 JSON 解析）。
set -u
cd /Users/bytedance/项目/jijiebei/backend || exit 1
BASE="http://127.0.0.1:8090"
CT="Content-Type: application/json"
get()  { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null; }
getr() { python3 -c "import sys,json;r=json.load(sys.stdin);print(r.get('record',{}).get('$1','') if isinstance(r.get('record'),dict) else '')" 2>/dev/null; }
req() { CODE=$(curl -s -o /tmp/jjb_last.json -w "%{http_code}" "$@"); BODY=$(cat /tmp/jjb_last.json); }

echo "================ 0. health ================"
curl -s "$BASE/api/health"; echo

echo "================ 1. create superuser (CLI) ================"
./pocketbase superuser upsert admin@jjb.test 'Admin123456!' 2>&1 | tail -2

echo "================ 2. superuser auth ================"
req -X POST "$BASE/api/collections/_superusers/auth-with-password" -H "$CT" \
  -d '{"identity":"admin@jjb.test","password":"Admin123456!"}'
SU_TOKEN=$(echo "$BODY" | get token)
echo "SU_TOKEN length=${#SU_TOKEN} (expect 223)"

echo "================ 3. create 3 accounts via superuser ================"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"admin@jjb.test","password":"Admin123456!","passwordConfirm":"Admin123456!","role":"admin","display_name":"管理员"}'
echo "admin: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"host@jjb.test","password":"Host123456!","passwordConfirm":"Host123456!","role":"host","display_name":"主播土豆"}'
echo "host: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"
req -X POST "$BASE/api/collections/accounts/records" -H "Authorization: $SU_TOKEN" -H "$CT" \
  -d '{"email":"viewer@jjb.test","password":"Viewer123456!","passwordConfirm":"Viewer123456!","role":"viewer","display_name":"观众"}'
echo "viewer: $(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('role'))" 2>/dev/null)"

echo "================ 4. auth 3 accounts ================"
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"admin@jjb.test","password":"Admin123456!"}'
ADM_TOKEN=$(echo "$BODY" | get token); ADM_ID=$(echo "$BODY" | getr id)
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"host@jjb.test","password":"Host123456!"}'
HOST_TOKEN=$(echo "$BODY" | get token); HOST_ID=$(echo "$BODY" | getr id)
req -X POST "$BASE/api/collections/accounts/auth-with-password" -H "$CT" -d '{"identity":"viewer@jjb.test","password":"Viewer123456!"}'
VIEW_TOKEN=$(echo "$BODY" | get token)
echo "ADM=${#ADM_TOKEN} HOST=${#HOST_TOKEN} VIEW=${#VIEW_TOKEN} (expect 223) HOST_ID=$HOST_ID"

echo "================ 5. create 2 players via admin ================"
req -X POST "$BASE/api/collections/players/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d '{"nickname":"选手甲","player_code":"P001","race_pref":"t","active":true}'
P1_ID=$(echo "$BODY" | get id)
req -X POST "$BASE/api/collections/players/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d '{"nickname":"选手乙","player_code":"P002","race_pref":"z","active":true}'
P2_ID=$(echo "$BODY" | get id)
echo "P1_ID=$P1_ID P2_ID=$P2_ID"

echo ""
echo "================ 6. PERMISSION MATRIX ================"
echo "--- 6a. host POST match (expect 200 ALLOWED, capture match id) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"match\",\"game_mode\":\"std12\",\"payload_code\":\"PERMTEST\",\"payload_ver\":1,\"players\":[\"$P1_ID\",\"$P2_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,2,0],\"score_total\":2}"
echo "HTTP $CODE | match id=$(echo "$BODY" | get id)"
M6A_ID=$(echo "$BODY" | get id)

echo "--- 6b. viewer POST match (expect DENIED — not 200) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $VIEW_TOKEN" -H "$CT" \
  -d '{"mode":"match","game_mode":"std8","payload_code":"X","payload_ver":1,"result":[1,0,0]}'
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"

echo "--- 6c. host POST scores with VALID match (expect DENIED — scores admin-only) ---"
req -X POST "$BASE/api/collections/scores/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"player\":\"$P1_ID\",\"match\":\"$M6A_ID\",\"delta\":99,\"reason\":\"host-attempt\",\"season\":\"2026S1\"}"
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"

echo "--- 6d. admin POST scores with VALID match (expect 200 ALLOWED — 契约 validation: admin 能改 scores) ---"
req -X POST "$BASE/api/collections/scores/records" -H "Authorization: $ADM_TOKEN" -H "$CT" \
  -d "{\"player\":\"$P1_ID\",\"match\":\"$M6A_ID\",\"delta\":5,\"reason\":\"admin-manual-adjust\",\"season\":\"2026S1\"}"
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 250)"

echo "--- 6e. admin PATCH logs (expect 403 DENIED — logs 不可改) ---"
req -X GET -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?perPage=1"
LID=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['items'][0]['id'] if d.get('items') else '')" 2>/dev/null)
echo "first log id=$LID"
req -X PATCH "$BASE/api/collections/logs/records/$LID" -H "Authorization: $ADM_TOKEN" -H "$CT" -d '{"action":"tampered"}'
echo "HTTP $CODE | body: $(echo "$BODY" | head -c 200)"

echo "--- 6f. anon GET matches (expect 200 PUBLIC READ) ---"
req "$BASE/api/collections/matches/records?perPage=1"
echo "HTTP $CODE"

echo "--- 6g. anon GET logs (expect 200 + empty) vs admin GET logs (expect 200 + items) ---"
req "$BASE/api/collections/logs/records?perPage=1"
echo "[anon] HTTP $CODE | items: $(echo "$BODY" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?perPage=3"
echo "[admin] HTTP $CODE | items: $(echo "$BODY" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null)"

echo ""
echo "================ 7. HOOK TEST ================"
echo "--- 7a. POST match mode=match result=[1,2,0] std12 → expect 200 + hook derives 2 scores delta=2.4 ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"match\",\"game_mode\":\"std12\",\"payload_code\":\"HOOK1\",\"payload_ver\":1,\"players\":[\"$P1_ID\",\"$P2_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,2,0],\"score_total\":2}"
echo "HTTP $CODE | match id=$(echo "$BODY" | get id)"
MHK_ID=$(echo "$BODY" | get id)
sleep 0.3
echo "--- 7b. GET scores filter match=MHK_ID (expect 2 items, delta=2.4 each) ---"
req "$BASE/api/collections/scores/records?filter=(match='$MHK_ID')"
echo "HTTP $CODE | $(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('totalItems=',d.get('totalItems'))
for it in d.get('items',[]):
    print('  player=',it.get('player'),'delta=',it.get('delta'),'reason=',it.get('reason'))
" 2>/dev/null)"

echo "--- 7c. GET logs action=score.adjust + match.create (admin, expect both) ---"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?filter=(action='score.adjust')"
echo "score.adjust totalItems: $(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)"
req -H "Authorization: $ADM_TOKEN" "$BASE/api/collections/logs/records?filter=(action='match.create')"
echo "match.create totalItems: $(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)"

echo "--- 7d. POST match mode=practice (expect 200, NO scores derived) ---"
req -X POST "$BASE/api/collections/matches/records" -H "Authorization: $HOST_TOKEN" -H "$CT" \
  -d "{\"mode\":\"practice\",\"game_mode\":\"std8\",\"payload_code\":\"PRAC1\",\"payload_ver\":1,\"players\":[\"$P1_ID\"],\"host\":\"$HOST_ID\",\"result\":[1,0,0],\"score_total\":1}"
echo "HTTP $CODE | practice match id=$(echo "$BODY" | get id)"
PRAC_ID=$(echo "$BODY" | get id)
sleep 0.3
echo "--- 7e. GET scores filter match=PRAC_ID (expect 0 items) ---"
req "$BASE/api/collections/scores/records?filter=(match='$PRAC_ID')"
echo "HTTP $CODE | totalItems: $(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalItems'))" 2>/dev/null)"

echo ""
echo "================ 8. RANKINGS ================"
echo "expect: P1 = 2.4(6a-hook) + 5(6d-admin) + 2.4(7a-hook) = 9.8 ; P2 = 2.4(6a) + 2.4(7a) = 4.8"
req "$BASE/api/rankings"
echo "HTTP $CODE | $(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('season=',d.get('season'),'count=',d.get('count'))
for r in d.get('rankings',[]):
    print('  ',r.get('nickname'),r.get('player_code'),'total_delta=',r.get('total_delta'),'score_count=',r.get('match_count'))
" 2>/dev/null)"

echo "================ 9. SCORING config ================"
req "$BASE/api/scoring"
echo "HTTP $CODE | $(echo "$BODY" | head -c 300)"

echo "================ 10. SQLite export (data.db + wal + shm) ================"
cp pb_data/data.db /tmp/jjb-export.db
cp pb_data/data.db-wal /tmp/jjb-export.db-wal 2>/dev/null || echo "(no wal)"
cp pb_data/data.db-shm /tmp/jjb-export.db-shm 2>/dev/null || true
echo "copied to /tmp/jjb-export.db{,-wal,-shm}"
sqlite3 /tmp/jjb-export.db ".tables"
echo "--- row counts ---"
sqlite3 /tmp/jjb-export.db "SELECT 'matches', COUNT(*) FROM matches UNION ALL SELECT 'scores', COUNT(*) FROM scores UNION ALL SELECT 'logs', COUNT(*) FROM logs UNION ALL SELECT 'players', COUNT(*) FROM players UNION ALL SELECT 'accounts', COUNT(*) FROM accounts;"

echo "================ DONE ================"
