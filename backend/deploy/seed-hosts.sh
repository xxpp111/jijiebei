#!/usr/bin/env bash
# 集结杯主播账号录入（host accounts）— 部署/初始化时跑一次。
# 前置：P5 PocketBase 在 8090 + superuser admin@jjb.test 已建（verify-all.sh 第 1 步）。
# 用法：bash seed-hosts.sh [BASE_URL]   默认 http://127.0.0.1:8090
# ⚠️ 密码为默认占位，生产环境务必改（土豆/歪比/老王/莽咕 上线前各自改密）。
set -u
BASE="${1:-http://127.0.0.1:8090}"
SU=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin@jjb.test","password":"Admin123456!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -z "$SU" ] && { echo "superuser auth 失败（先跑 verify-all.sh 建 superuser）"; exit 1; }

# 主播名单（email|password|display_name），role 全 host
for h in \
  "host@jjb.test|Host123456!|主播土豆" \
  "waibi@jjb.test|Waibi123456!|主播歪比" \
  "laowang@jjb.test|Laowang123456!|主播老王" \
  "manggu@jjb.test|Manggu123456!|主播莽咕"; do
  email="${h%%|*}"; rest="${h#*|}"; pwd="${rest%%|*}"; name="${rest#*|}"
  curl -s -X POST "$BASE/api/collections/accounts/records" \
    -H "Authorization: $SU" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pwd\",\"passwordConfirm\":\"$pwd\",\"role\":\"host\",\"display_name\":\"$name\"}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print('  +',d.get('display_name',d.get('message','已存在')))"
done
echo "主播录入完成（host role）"
