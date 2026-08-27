---
title: 集结杯 · 搬迁手册
id: jijiebei/migration
status: current
owner: jjb-hub
updated: 2026-08-27
applies_to: ["更换 operator 电脑并恢复 JJB 工作环境", "将 PocketBase 服务与数据迁移到新服务器", "迁服演练、切流、回滚与旧机下线"]
replaces: []
evidence: ["docs/deployment.md（部署与恢复命令唯一真相）", "docs/backup-restore-manifest.json（加密备份机器真相）", "backend/deploy/jjb-backend.service 与 nginx-docker-triple.conf（运行拓扑）", "PocketBase 官方生产指南：https://pocketbase.io/docs/going-to-production/"]
review_after: 2026-09-27
---
# 集结杯 · 搬迁手册

> 本文是**搬迁总编排**，不是第二份部署命令真相。低层安装、systemd、Docker nginx、migration、健康检查与现有加密恢复命令均以 [deployment.md](deployment.md) 为准；备份 repo/tag/asset/hash 只从 [backup-restore-manifest.json](backup-restore-manifest.json) 读取。
>
> 当前公开 manifest 的分类仍是 `hot-safety-only-allow-with-warning`。它只能用于应急 staging 验证，**不能作为正式迁服的 cold authoritative backup**。未生成、校验、加密上传并完成恢复演练的 cold 包时，服务器 cutover 必须 fail closed。

---

## 0. 先判定是哪一种“搬迁”

| 场景 | 是否迁生产数据 | 入口 |
|---|---:|---|
| 只换 operator 电脑，生产服务仍在旧服务器 | 否 | 走 [§2 换电脑](#2-只换-operator-电脑) |
| 新电脑上只做离线恢复演练 | 否 | 走 §2，再按 deployment §7.4 停在 0700 staging |
| 换服务器、旧电脑本身承载服务、或要更换生产入口 | 是 | 走 [§3–§10 完整服务器搬迁](#3-服务器搬迁总门禁) |
| 只有当前 hot 包，旧服务器已不可用 | 应急 | 只允许恢复到 staging；live 写回必须另立 owner 批准的事故契约 |

**服务器搬迁总门禁**：以下任一项为“否”就停止，不得切流：

- [ ] 维护窗口、cutover 负责人和 rollback 负责人已明确；
- [ ] 旧机可以停服并确认无写者；
- [ ] 完整 `pb_data` 的 cold snapshot 已生成并通过校验；
- [ ] cold snapshot 已交互式 GPG AES256 加密，且完成一次解密复验；
- [ ] 密文已进入 PRIVATE 存储，公开仓只有标识与 hash；
- [ ] 目标机 staging restore 已通过文件、SQLite、migration 与计数门；
- [ ] 入口切换方案稳定、可逆，且不依赖重启 cloudflared quick tunnel；
- [ ] 旧机和新机不会同时接受写入。

---

## 1. 搬迁记录表（不得记录秘密）

在私有工单或本地受控笔记中填写；不要把真实账号密码、token、GPG 口令、私钥或下载凭据写入仓库、聊天、命令参数、env 或日志。

| 字段 | 要记录什么 |
|---|---|
| `SOURCE_HOST` / `TARGET_HOST` | SSH alias 或资产标识，不写密码 |
| `SOURCE_HEAD` / `TARGET_SHA` | 源机完整 Git SHA / 已批准目标完整 40 位 Git SHA；分支名（通常 `jjb-platform`）只作人读标签，不参与执行 |
| `SOURCE_CODE_DIR` | 源机 `$HOME` 下的源码 checkout basename；旧 devbox 通常 `jijiebei-deploy`，按本文新部署的服务器为 `jijiebei-source` |
| 维护窗口 | 开始、预计结束、公告渠道 |
| cutover / rollback owner | 能批准切流与回退的人 |
| source data root | 当前真相应为 `/opt/jjb-backend/pb_data` |
| cold artifact | 私有 tag、密文文件名、ciphertext/plaintext SHA、文件集摘要 |
| 旧机基线 | service 状态、版本、migration 集、目录字节数与文件数 |
| 业务基线 | 只记各集合 count，不复制业务行 |
| 入口 | 旧/新内网地址、正式 DNS/TLB/反代变更；quick tunnel 仅记“不可重启” |
| 回滚窗口 | 旧机保留到何时；谁批准关闭 |

### 1.1 只换 operator 电脑的初始化

只执行本块，不设置也不校验服务器 host：

```bash
set -euo pipefail
OPERATOR_INIT=1
# export TARGET_SHA='replace-with-approved-40-hex-commit'
# 仅受限网络需要；非受限电脑留空，且 URL 不得内含账号密码：
# export TARGET_GIT_PROXY='http://sys-proxy-rd-relay.byted.org:8118'
: "${TARGET_SHA:?set TARGET_SHA}"
printf '%s' "$TARGET_SHA" | grep -Eq '^[0-9a-f]{40}$' || {
  echo "BLOCKED: TARGET_SHA must be an approved full 40-hex commit" >&2
  exit 1
}
TARGET_GIT_PROXY=${TARGET_GIT_PROXY:-}
case "$TARGET_GIT_PROXY" in
  *://*@*) echo "BLOCKED: proxy URL must not contain credentials" >&2; exit 1 ;;
esac
```

### 1.2 迁生产服务器的初始化

服务器路径执行本块；四个变量缺一即停止：

```bash
set -euo pipefail
SERVER_MIGRATION_INIT=1
# export SOURCE_HOST='replace-with-old-ssh-alias'
# export TARGET_HOST='replace-with-new-ssh-alias'
# export SOURCE_CODE_DIR='jijiebei-deploy-or-jijiebei-source'
# export TARGET_SHA='replace-with-approved-40-hex-commit'
# 仅公司受限 devbox 需要；非受限主机留空，且 URL 不得内含账号密码：
# export TARGET_GIT_PROXY='http://sys-proxy-rd-relay.byted.org:8118'
: "${SOURCE_HOST:?set SOURCE_HOST}"
: "${TARGET_HOST:?set TARGET_HOST}"
: "${SOURCE_CODE_DIR:?set SOURCE_CODE_DIR}"
: "${TARGET_SHA:?set TARGET_SHA}"
case "$SOURCE_CODE_DIR" in
  ''|.|..|*[!A-Za-z0-9._-]*) echo "BLOCKED: SOURCE_CODE_DIR must be a basename" >&2; exit 1 ;;
esac
printf '%s' "$TARGET_SHA" | grep -Eq '^[0-9a-f]{40}$' || {
  echo "BLOCKED: TARGET_SHA must be an approved full 40-hex commit" >&2
  exit 1
}
TARGET_GIT_PROXY=${TARGET_GIT_PROXY:-}
case "$TARGET_GIT_PROXY" in
  *://*@*) echo "BLOCKED: proxy URL must not contain credentials" >&2; exit 1 ;;
esac
```

---

## 2. 只换 operator 电脑

这一条路径**不迁生产数据、不停旧服务、不改生产入口**。

1. 在新电脑安装 `git`、`gh`、`gpg`、`node`、`npm`、`go`、`python3`、`shasum`/`sha256sum`、`tar` 和 SSH 客户端。
2. 登录 GitHub，确认能读取 public 代码仓和 manifest 指向的 PRIVATE backup repo：

   ```bash
   set -euo pipefail
   : "${TARGET_SHA:?set approved TARGET_SHA}"
   printf '%s' "$TARGET_SHA" | grep -Eq '^[0-9a-f]{40}$'
   TARGET_GIT_PROXY=${TARGET_GIT_PROXY:-}
   case "$TARGET_GIT_PROXY" in
     *://*@*) echo "BLOCKED: proxy URL must not contain credentials" >&2; exit 1 ;;
   esac
   if [ -n "$TARGET_GIT_PROXY" ]; then
     export http_proxy="$TARGET_GIT_PROXY" https_proxy="$TARGET_GIT_PROXY"
     export no_proxy='.byted.org,localhost,127.0.0.1,::1'
   fi
   gh auth status
   git clone https://github.com/xxpp111/jijiebei.git
   cd jijiebei
   git fetch origin --prune
   git cat-file -e "$TARGET_SHA^{commit}"
   git checkout --detach "$TARGET_SHA"
   test "$(git rev-parse HEAD)" = "$TARGET_SHA"
   git status --short
   ```

3. 从密码管理器确认 GPG symmetric 口令仍可由 owner 取得；**不要把口令交给 AI，也不要试图从 GitHub 找回**。
4. 需要证明数据可恢复时，按 deployment §7.4 执行 PRIVATE 下载与四层完整性门；默认停在 `~/jjb-restore-*/staging`。
5. 不把 staging 复制到生产 `pb_data`，不改旧服务器，不重启 cloudflared。

完成条件：源码可构建、PRIVATE Release 可访问、密文与 plaintext/hash/SQLite 门通过；生产服务保持原样。

---

## 3. 服务器搬迁总门禁

### 3.1 旧机只读预检

先确认仓库与运行配置，不要直接用 `sqlite3` 打开 live DB，也不要读取业务行：

```bash
ssh "$SOURCE_HOST" bash -s -- "$SOURCE_CODE_DIR" <<'REMOTE'
set -euo pipefail
SOURCE_CODE_DIR=$1
sudo systemctl is-active --quiet jjb-backend
sudo systemctl is-enabled --quiet jjb-backend
sudo cat /etc/systemd/system/jjb-backend.service
curl -fsS http://127.0.0.1:8090/api/health >/dev/null
sudo test -d /opt/jjb-backend/pb_data
sudo du -sb /opt/jjb-backend/pb_data
sudo find /opt/jjb-backend/pb_data -type f -print | wc -l
git -C "$HOME/$SOURCE_CODE_DIR" rev-parse HEAD
git -C "$HOME/$SOURCE_CODE_DIR" status --short
REMOTE
```

核对当前拓扑仍与仓内资产一致：

- `jjb-backend.service`：`User=jjb`、`0.0.0.0:8090`、数据目录 `/opt/jjb-backend/pb_data`；
- Docker nginx：容器内 `:80`，宿主 `8080`，反代宿主 `172.17.0.1:8090`；
- 正式公网入口必须走已批准的稳定方案。cloudflared quick tunnel 重启会换 URL，**不得把“重启 tunnel”当作 cutover 或修复动作**。

在已 checkout 到批准 `TARGET_SHA` 的本地仓上运行 migration 双向兼容检查；它同时拒绝“源库缺目标迁移”和“源库已有、目标 SHA 不认识”的版本倒退，任一方向不一致都停止：

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = "$TARGET_SHA"
node backend/scripts/check-migrations.mjs "$SOURCE_HOST" /opt/jjb-backend/pb_data/data.db
```

### 3.2 预检记录边界

- 记录 PocketBase 版本、完整 Git SHA、migration 文件集合、数据目录文件数/字节数。
- 账号、选手、场次、积分、日志只记录 count；不把邮箱、手机号、昵称、密码 hash、token 或业务行写进共享日志。
- 生产 DB 的结构与 count 在停服后的 cold staging 副本上查询；不要为了“只读检查”打开 live SQLite 后再手工清理 WAL/SHM。

---

## 4. 维护窗口与 cold authoritative backup

PocketBase 官方建议手工复制/替换 `pb_data` 前停止服务；`pb_data` 包含数据库、上传文件和其他应用数据。正式迁服必须备份**整个目录**，不能只复制 `data.db`，也不能把在线 `data.db + wal + shm` 三件套冒充跨库/附件原子快照。

### 4.1 停写并确认无写者

```bash
ssh "$SOURCE_HOST" 'set -euo pipefail
  sudo systemctl stop jjb-backend
  if sudo systemctl is-active --quiet jjb-backend; then
    echo "BLOCKED: jjb-backend is still active" >&2
    exit 1
  fi
  MAIN_PID=$(sudo systemctl show jjb-backend --property=MainPID --value)
  if [ "${MAIN_PID:-0}" != "0" ]; then
    echo "BLOCKED: jjb-backend MainPID=$MAIN_PID after stop" >&2
    exit 1
  fi
  if sudo pgrep -x pocketbase >/dev/null; then
    echo "BLOCKED: a PocketBase process still exists" >&2
    sudo pgrep -a -x pocketbase >&2 || true
    exit 1
  fi
  sudo test -d /opt/jjb-backend/pb_data
  echo "cold-window-ready"
'
```

停服后保持旧机冻结。不要删除、重命名或清理 source `pb_data` / WAL / SHM。

### 4.2 制作完整冷快照

在旧机选择**仓库外**、权限为 0700、空间充足的工作目录。以下命令只生成新归档，不修改 source：

```bash
set -euo pipefail
# 在旧机的维护 shell 中执行
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
COLD_WORK="$HOME/jjb-cold-$STAMP"
ARCHIVE="$COLD_WORK/jjb-cold-$STAMP-pb_data.tar.gz"
INDEXER="$COLD_WORK/snapshot-index.py"
SOURCE_INDEX="$COLD_WORK/source.files.jsonl"
RESTORED_INDEX="$COLD_WORK/restored.files.jsonl"
install -d -m 700 "$COLD_WORK/staging"

cat > "$INDEXER" <<'PY'
import hashlib, json, os, stat, sys
from pathlib import Path

root = Path(sys.argv[1]).resolve(strict=True)
records = []
for base, dirs, files in os.walk(root, topdown=True, followlinks=False):
    dirs.sort(key=os.fsencode)
    files.sort(key=os.fsencode)
    for name in [*dirs, *files]:
        path = Path(base) / name
        rel = path.relative_to(root).as_posix()
        info = os.lstat(path)
        if stat.S_ISREG(info.st_mode):
            digest = hashlib.sha256()
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            record = {"path": rel, "type": "file", "size": info.st_size, "sha256": digest.hexdigest()}
        elif stat.S_ISDIR(info.st_mode):
            record = {"path": rel, "type": "dir"}
        elif stat.S_ISLNK(info.st_mode):
            record = {"path": rel, "type": "symlink", "target": os.readlink(path)}
        else:
            raise SystemExit(f"unsupported special file in pb_data: {rel}")
        records.append(record)
records.sort(key=lambda record: os.fsencode(record["path"]))
for record in records:
    print(json.dumps(record, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
PY
chmod 700 "$INDEXER"

# receipt 只留在 0700 私有工作目录；控制台只打印 count/hash，不打印路径。
sudo python3 "$INDEXER" /opt/jjb-backend/pb_data > "$SOURCE_INDEX"
test -s "$SOURCE_INDEX"
chmod 600 "$SOURCE_INDEX"
sha256sum "$SOURCE_INDEX" > "$SOURCE_INDEX.sha256"
printf 'source_entries=%s fileset_sha256=%s\n' \
  "$(wc -l < "$SOURCE_INDEX" | tr -d ' ')" \
  "$(cut -d' ' -f1 "$SOURCE_INDEX.sha256")"

sudo tar --numeric-owner --xattrs --acls \
  -C /opt/jjb-backend -czf "$ARCHIVE" pb_data
sudo chown "$(id -u):$(id -g)" "$ARCHIVE"
chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
```

立即在**同一个维护 shell**中检查归档路径、完整解包、source↔restored canonical 文件集和所有 SQLite 文件；私有索引含相对路径但不上传、不贴日志，控制台只打印 count/hash 与 DB 文件名：

```bash
set -euo pipefail
python3 - "$ARCHIVE" <<'PY'
import sys, tarfile
from pathlib import PurePosixPath

archive = sys.argv[1]
with tarfile.open(archive, "r:gz") as tf:
    members = tf.getmembers()
    if not members:
        raise SystemExit("empty cold archive")
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"unsafe archive path: {member.name}")
        if not path.parts or path.parts[0] != "pb_data":
            raise SystemExit(f"archive path outside pb_data: {member.name}")
        if member.issym():
            target = PurePosixPath(member.linkname)
            resolved = path.parent / target
            if target.is_absolute() or ".." in resolved.parts or not resolved.parts or resolved.parts[0] != "pb_data":
                raise SystemExit(f"unsafe symlink target: {member.name}")
        if member.islnk():
            target = PurePosixPath(member.linkname)
            if target.is_absolute() or ".." in target.parts or not target.parts or target.parts[0] != "pb_data":
                raise SystemExit(f"unsafe hardlink target: {member.name}")
print(f"archive-paths=ok entries={len(members)}")
PY

tar -xzf "$ARCHIVE" -C "$COLD_WORK/staging"
python3 "$INDEXER" "$COLD_WORK/staging/pb_data" > "$RESTORED_INDEX"
chmod 600 "$RESTORED_INDEX"
if ! cmp -s "$SOURCE_INDEX" "$RESTORED_INDEX"; then
  echo "BLOCKED: source and restored canonical file sets differ" >&2
  printf 'source_fileset_sha256=%s restored_fileset_sha256=%s\n' \
    "$(sha256sum "$SOURCE_INDEX" | cut -d' ' -f1)" \
    "$(sha256sum "$RESTORED_INDEX" | cut -d' ' -f1)" >&2
  exit 1
fi
printf 'restored_entries=%s fileset_sha256=%s\n' \
  "$(wc -l < "$RESTORED_INDEX" | tr -d ' ')" \
  "$(sha256sum "$RESTORED_INDEX" | cut -d' ' -f1)"

# 保持已对账的 staging 原样；SQLite 只在可写 validation copy 中读取 WAL/SHM。
VALIDATION_PB_DATA="$COLD_WORK/sqlite-validation/pb_data"
install -d -m 700 "$COLD_WORK/sqlite-validation"
cp -a "$COLD_WORK/staging/pb_data" "$VALIDATION_PB_DATA"
chmod -R u+rwX "$COLD_WORK/sqlite-validation"

python3 - "$VALIDATION_PB_DATA" <<'PY'
import sqlite3, sys
from pathlib import Path
root = Path(sys.argv[1])
dbs = sorted(root.rglob("*.db"))
if not dbs:
    raise SystemExit("no SQLite databases in cold snapshot")
for path in dbs:
    # validation copy 可写；mode=ro 会读取同目录 WAL/SHM，immutable=1 会忽略 WAL，禁止使用。
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    result = con.execute("PRAGMA quick_check").fetchone()[0]
    con.close()
    if result != "ok":
        raise SystemExit(f"{path.relative_to(root)}: quick_check={result}")
    print(f"{path.relative_to(root)}: quick_check=ok")
PY
```

失败时：保留旧机停服和失败现场，不切流；修复备份流程后重新生成新的 artifact，不覆盖旧失败归档。若 owner 决定取消本次迁服，且 source `pb_data` 从停服起未被改动，则可在确认目录/权限后重新启动旧机、跑 deployment §6 健康检查并结束维护窗口；不要让旧机在迁服仍继续时恢复写入。

### 4.3 加密、复验与 PRIVATE 上传

口令由 GPG 交互式 pinentry 向 owner 获取；禁止 `--passphrase`、env 或脚本变量：

```bash
set -euo pipefail
gpg --symmetric --cipher-algo AES256 \
  --output "$ARCHIVE.gpg" "$ARCHIVE"
sha256sum "$ARCHIVE.gpg" > "$ARCHIVE.gpg.sha256"

gpg --output "$COLD_WORK/verify.tar.gz" --decrypt "$ARCHIVE.gpg"
test "$(sha256sum "$COLD_WORK/verify.tar.gz" | cut -d" " -f1)" = \
     "$(cut -d" " -f1 "$ARCHIVE.sha256")"
echo "cold-encryption-roundtrip=ok"
```

上传前另生成**脱敏** manifest，至少记录：artifact id、classification=cold authoritative、密文文件名、ciphertext/plaintext SHA、完整相对文件集摘要、PocketBase/Git SHA、`contains_plaintext_data=false`。它不得含口令、token、私钥、业务行或本机绝对路径。

只允许把 `.gpg`、密文 SHA 和脱敏 manifest 上传到 PRIVATE repo。明文 archive、解包后的 `pb_data`、密码和凭据不得上传。可在持有密文且已登录 GitHub 的受控电脑执行：

```bash
set -euo pipefail
: "${COLD_TAG:?set a new immutable cold release tag}"
: "${SANITIZED_MANIFEST:?set sanitized manifest path}"
test -f "$ARCHIVE.gpg"
test -f "$ARCHIVE.gpg.sha256"
test -f "$SANITIZED_MANIFEST"
BACKUP_REPO=$(node -p "require('./docs/backup-restore-manifest.json').backup_source.repository")
test "$(gh repo view "$BACKUP_REPO" --json visibility -q .visibility)" = PRIVATE

gh release create "$COLD_TAG" --repo "$BACKUP_REPO" \
  "$ARCHIVE.gpg" "$ARCHIVE.gpg.sha256" "$SANITIZED_MANIFEST" \
  --title "$COLD_TAG" --notes "Encrypted cold authoritative migration backup"
gh release view "$COLD_TAG" --repo "$BACKUP_REPO" --json assets
```

上传后将 GitHub 返回的 asset digest 与本地 ciphertext SHA 再对账。若 tag 已存在或任何 digest 不一致，停止并使用新的 immutable tag；不要覆盖既有 Release 资产。

> **机器真相更新门**：当前 `docs/backup-restore-manifest.json` 仍指向 hot 包。只有新的 cold artifact 已完成上述生成、加密、PRIVATE 上传和 staging restore，才另立受审变更更新 repo/tag/asset/hash/classification；如果 cold 包布局与 deployment §7.4 不同，必须在同一轮同步更新并验证恢复契约。完成前服务器搬迁继续 BLOCKED。

---

## 5. 新机部署（先不接生产流量）

1. 在新机把 PUBLIC repo clone 到**只读源码目录** `~/jijiebei-source`，并以已批准的完整 `TARGET_SHA` detached checkout；生成的 web/admin/nginx 产物另放 `~/jijiebei-deploy`，不得写回受 clean-tree 门检查的源码 checkout。公司受限 devbox 必须显式传入不含凭据的 shell proxy，非受限主机用 `-` 表示不注入：

   ```bash
   set -euo pipefail
   PROXY_ARG=${TARGET_GIT_PROXY:--}
   ssh "$TARGET_HOST" bash -s -- "$TARGET_SHA" "$PROXY_ARG" <<'REMOTE'
   set -euo pipefail
   TARGET_SHA=$1
   TARGET_GIT_PROXY=$2
   if [ "$TARGET_GIT_PROXY" = "-" ]; then
     TARGET_GIT_PROXY=
   fi
   if [ -n "$TARGET_GIT_PROXY" ]; then
     export http_proxy="$TARGET_GIT_PROXY" https_proxy="$TARGET_GIT_PROXY"
     export no_proxy='.byted.org,localhost,127.0.0.1,::1'
   fi
   TARGET_SOURCE_DIR="$HOME/jijiebei-source"
   TARGET_RUNTIME_DIR="$HOME/jijiebei-deploy"
   if [ ! -d "$TARGET_SOURCE_DIR/.git" ]; then
     git clone https://github.com/xxpp111/jijiebei.git "$TARGET_SOURCE_DIR"
   fi
   cd "$TARGET_SOURCE_DIR"
   git fetch origin --prune
   git cat-file -e "$TARGET_SHA^{commit}"
   git checkout --detach "$TARGET_SHA"
   test "$(git rev-parse HEAD)" = "$TARGET_SHA"
   test -z "$(git status --porcelain --untracked-files=all)"
   install -d -m 0755 "$TARGET_RUNTIME_DIR"
   REMOTE
   ```

2. 在同一批准 SHA 的**本地干净 checkout** 中探测目标机器架构、映射 Go 目标并构建；不认识的架构、checkout 漂移或 ELF 不匹配时立即停止：

   ```bash
   set -euo pipefail
   test "$(git rev-parse HEAD)" = "$TARGET_SHA"
   git cat-file -e "$TARGET_SHA^{commit}"
   TARGET_MACHINE=$(ssh "$TARGET_HOST" uname -m)
   case "$TARGET_MACHINE" in
     x86_64)        TARGET_GOARCH=amd64 ;;
     aarch64|arm64) TARGET_GOARCH=arm64 ;;
     *) echo "BLOCKED: unsupported target architecture $TARGET_MACHINE" >&2; exit 1 ;;
   esac
   printf 'target_machine=%s target_goarch=%s\n' "$TARGET_MACHINE" "$TARGET_GOARCH"

   BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/jjb-backend-build.XXXXXX")
   chmod 700 "$BUILD_DIR"
   BUILD_SOURCE="$BUILD_DIR/source"
   install -d -m 700 "$BUILD_SOURCE"
   git archive --format=tar "$TARGET_SHA" | tar -xf - -C "$BUILD_SOURCE"
   BUILD_ARTIFACT="$BUILD_DIR/pocketbase-linux-$TARGET_GOARCH"
   (
     cd "$BUILD_SOURCE/backend"
     GOOS=linux GOARCH="$TARGET_GOARCH" go build -o "$BUILD_ARTIFACT" .
   )

   FILE_OUTPUT=$(file "$BUILD_ARTIFACT")
   printf '%s\n' "$FILE_OUTPUT"
   case "$TARGET_GOARCH" in
     amd64) grep -Eq 'ELF 64-bit.*(x86-64|x86_64)' <<<"$FILE_OUTPUT" ;;
     arm64) grep -Eq 'ELF 64-bit.*(ARM aarch64|aarch64)' <<<"$FILE_OUTPUT" ;;
   esac
   printf 'build_artifact=%s\n' "$BUILD_ARTIFACT"
   ```

3. 使用 `$TARGET_HOST` 和刚生成的 `$BUILD_ARTIFACT` 传输、安装 backend/config/systemd；不要执行 deployment §2.2 中硬编码旧 devbox 与 amd64 文件名的示例。准备阶段必须让新机 backend 保持 **stopped 且 disabled**，直到 §7 owner 批准 live 数据后才 enable：

   ```bash
   set -euo pipefail
   REMOTE_STAGE="/tmp/jjb-deploy-$TARGET_SHA"
   ssh "$TARGET_HOST" "install -d -m 700 '$REMOTE_STAGE'"
   scp "$BUILD_ARTIFACT" "$TARGET_HOST:$REMOTE_STAGE/pocketbase"
   scp "$BUILD_SOURCE/backend/config/scoring.json" "$TARGET_HOST:$REMOTE_STAGE/scoring.json"
   scp "$BUILD_SOURCE/backend/deploy/jjb-backend.service" "$TARGET_HOST:$REMOTE_STAGE/jjb-backend.service"

   ssh "$TARGET_HOST" bash -s -- "$REMOTE_STAGE" <<'REMOTE'
   set -euo pipefail
   REMOTE_STAGE=$1
   sudo systemctl stop jjb-backend 2>/dev/null || true
   if sudo systemctl is-active --quiet jjb-backend; then
     echo "BLOCKED: target jjb-backend is still active" >&2
     exit 1
   fi
   id -u jjb >/dev/null 2>&1 || sudo useradd -r jjb
   sudo install -d -m 0750 -o jjb -g jjb \
     /opt/jjb-backend /opt/jjb-backend/config /opt/jjb-backend/pb_data
   sudo install -m 0755 -o jjb -g jjb \
     "$REMOTE_STAGE/pocketbase" /opt/jjb-backend/pocketbase
   sudo install -m 0644 -o jjb -g jjb \
     "$REMOTE_STAGE/scoring.json" /opt/jjb-backend/config/scoring.json
   sudo install -m 0644 -o root -g root \
     "$REMOTE_STAGE/jjb-backend.service" /etc/systemd/system/jjb-backend.service
   sudo systemctl daemon-reload
   sudo systemctl disable jjb-backend >/dev/null
   if sudo systemctl is-enabled --quiet jjb-backend; then
     echo "BLOCKED: target backend must remain disabled before live restore" >&2
     exit 1
   fi
   if sudo systemctl is-active --quiet jjb-backend; then
     echo "BLOCKED: target backend started before restore approval" >&2
     exit 1
   fi
   REMOTE
   ```

4. 仍从同一个 `$BUILD_SOURCE` 构建 web/admin，并把静态产物与 tracked nginx 配置参数化传到 `$TARGET_HOST`；不要执行 deployment §2.4 的本机绝对路径或旧 devbox 地址示例：

   ```bash
   set -euo pipefail
   npm --prefix "$BUILD_SOURCE/web" ci
   npm --prefix "$BUILD_SOURCE/web" run build
   npm --prefix "$BUILD_SOURCE/admin" ci
   npm --prefix "$BUILD_SOURCE/admin" run build
   test -f "$BUILD_SOURCE/web/dist/index.html"
   test -f "$BUILD_SOURCE/admin/dist/index.html"

   tar -C "$BUILD_SOURCE/web/dist" -czf "$BUILD_DIR/web-dist.tar.gz" .
   tar -C "$BUILD_SOURCE/admin/dist" -czf "$BUILD_DIR/admin-dist.tar.gz" .
   REMOTE_STAGE="/tmp/jjb-deploy-$TARGET_SHA"
   scp "$BUILD_DIR/web-dist.tar.gz" "$TARGET_HOST:$REMOTE_STAGE/web-dist.tar.gz"
   scp "$BUILD_DIR/admin-dist.tar.gz" "$TARGET_HOST:$REMOTE_STAGE/admin-dist.tar.gz"
   scp "$BUILD_SOURCE/backend/deploy/nginx-docker-triple.conf" \
     "$TARGET_HOST:$REMOTE_STAGE/nginx-default.conf"

   ssh "$TARGET_HOST" bash -s -- "$REMOTE_STAGE" <<'REMOTE'
   set -euo pipefail
   REMOTE_STAGE=$1
   TARGET_RUNTIME_DIR="$HOME/jijiebei-deploy"
   SNAPSHOT=$(date -u +%Y%m%dT%H%M%SZ)
   for dir in "$TARGET_RUNTIME_DIR/web/dist" "$TARGET_RUNTIME_DIR/admin/dist"; do
     if [ -d "$dir" ]; then mv "$dir" "$dir.pre-$SNAPSHOT"; fi
     install -d -m 0755 "$dir"
   done
   tar -xzf "$REMOTE_STAGE/web-dist.tar.gz" -C "$TARGET_RUNTIME_DIR/web/dist"
   tar -xzf "$REMOTE_STAGE/admin-dist.tar.gz" -C "$TARGET_RUNTIME_DIR/admin/dist"
   install -d -m 0755 "$TARGET_RUNTIME_DIR/nginx-conf"
   install -m 0644 "$REMOTE_STAGE/nginx-default.conf" \
     "$TARGET_RUNTIME_DIR/nginx-conf/default.conf"
   REMOTE
   ```

   nginx 镜像和容器拓扑仍以 deployment §2.5 为准，但迁服必须用下面的 `$TARGET_HOST` 参数化命令，不执行该文档中的旧 devbox 地址。若目标 dockerd 无法 pull，先按 deploy skill 的参数化 fallback 把匹配架构镜像灌到同一 `$TARGET_HOST`，再重跑：

   ```bash
   set -euo pipefail
   ssh "$TARGET_HOST" bash -s -- "$TARGET_GOARCH" <<'REMOTE'
   set -euo pipefail
   TARGET_GOARCH=$1
   TARGET_RUNTIME_DIR="$HOME/jijiebei-deploy"
   case "$TARGET_GOARCH" in amd64|arm64) ;; *) echo "unsupported GOARCH" >&2; exit 1 ;; esac
   IMAGE_ARCH=$(docker image inspect --format '{{.Architecture}}' nginx:1.27-alpine 2>/dev/null || true)
   if [ "$IMAGE_ARCH" != "$TARGET_GOARCH" ]; then
     docker pull --platform="linux/$TARGET_GOARCH" nginx:1.27-alpine
   fi
   test "$(docker image inspect --format '{{.Architecture}}' nginx:1.27-alpine)" = "$TARGET_GOARCH"
   docker run --rm nginx:1.27-alpine nginx -v
   docker stop jijiebei-nginx 2>/dev/null || true
   docker rm jijiebei-nginx 2>/dev/null || true
   docker run -d --name jijiebei-nginx --restart=always \
     -p 8080:80 \
     -v "$TARGET_RUNTIME_DIR/web/dist:/usr/share/nginx/html:ro" \
     -v "$TARGET_RUNTIME_DIR/admin/dist:/admin/dist:ro" \
     -v "$TARGET_RUNTIME_DIR/nginx-conf/default.conf:/etc/nginx/conf.d/default.conf:ro" \
     nginx:1.27-alpine
   docker inspect -f 'restart={{.HostConfig.RestartPolicy.Name}}' jijiebei-nginx
   REMOTE
   ```

5. 在正式数据写入前，backend 保持 stopped **且 disabled**；nginx 不接生产 DNS/TLB。cold staging 恢复和 migration/count 对账通过后，才进入 §7 的 human-in-the-loop live 目录写入。

---

## 6. 隔离 staging restore

### 6.1 当前 hot 包的演练

按 deployment §7.4 从 public manifest 读取 PRIVATE repo/tag/asset/hash，完成：

1. PRIVATE 权限；
2. ciphertext SHA；
3. 交互式解密 + plaintext SHA；
4. `SHA256SUMS.relative`、canonical relative-set digest、SQLite `quick_check`。

四门通过仍只代表 hot 包可读，**不授权 server cutover**。

### 6.2 cold 包的放行条件

cold staging 必须额外证明：

- 解包后完整根目录是 `pb_data`，没有路径逃逸；
- 全部 SQLite `PRAGMA quick_check=ok`；
- 文件数、总字节数、完整相对文件集摘要与旧机 cold receipt 一致；
- `_migrations` id 集与 `TARGET_SHA` 的 JJB migration 集双向兼容；
- 账号、选手、场次、积分、日志等集合 count 与旧机 cold 基线一致；
- 附件文件集与字节数一致；
- 没有输出业务行、密码 hash 或 token。

可在**隔离 staging 副本**上采集 count：

```bash
: "${VALIDATION_PB_DATA:?set writable WAL-aware validation copy}"
python3 - "$VALIDATION_PB_DATA/data.db" <<'PY'
import sqlite3, sys
con = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
for table in ("_superusers", "accounts", "player_accounts", "players", "matches", "scores", "logs", "event_rules"):
    count = con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    print(f"{table}={count}")
print("migration_ids:")
for (file_name,) in con.execute('SELECT file FROM "_migrations" ORDER BY file'):
    print(f"  {file_name}")
con.close()
PY
```

计数记录放私有搬迁工单，不提交仓库。不要在恢复后的 production 数据上运行会造测试账号/记录的 `verify-all.sh`；该脚本只用于隔离测试环境。

---

## 7. 写入目标 live 目录

这是 human-in-the-loop 硬门。只有 owner 明确批准、cold staging 全绿、旧机保持停服且目标 backend 未运行时才执行：

1. 目标现有 `pb_data` 原样移动为带时间戳的 rollback copy；
2. 从已验证的 cold staging 复制完整 `pb_data` 到新目录；
3. 保持 source staging 不变，设置 owner/group 为 `jjb:jjb`；
4. 启动 `jjb-backend` 前再次核验目录、权限和 SHA；
5. owner 再次确认 live 目录、权限与 SHA 后，执行 `ssh "$TARGET_HOST" 'sudo systemctl enable --now jjb-backend'`；按 deployment §6 检查 backend、web、admin、`/api`、`/_/`、天梯和系数；
6. 在未切生产入口前完成 migration 与 count 对账。

任何门失败：停止 target backend，保留失败现场与 rollback copy，不碰旧机 source。

---

## 8. Cutover：只允许一个写入端

切流顺序固定：

1. 旧机 `jjb-backend` 仍为 stopped，客户端写入已冻结；
2. 新机 staging/live 验证全部通过；
3. 切换已批准的 DNS/TLB/反代/内网入口；
4. 从入口侧验证 web/admin/API/Admin UI/SSE；
5. owner 确认后才解除写入冻结；
6. 记录“新机首次生产写入”的时间。

禁止：

- 旧机与新机同时运行并接受写入；
- 用重启 cloudflared quick tunnel 代替稳定 cutover；
- cold gate 未完成就更改生产入口；
- 因 health=200 就跳过 migration、count 或附件验证。

---

## 9. Cutover 后验证

### 技术门

- `systemctl is-active/is-enabled jjb-backend` 正常；
- backend `0.0.0.0:8090`、Docker nginx `172.17.0.1:8090`、宿主 `8080` 与仓内拓扑一致；
- deployment §6 的健康检查全部通过；
- journal/nginx 日志无启动、migration、权限、SSE 或附件错误；
- 重启 backend 与 nginx 后数据仍在（在维护窗口内验证）。

### 数据与业务门

- migration 集合一致；
- 八个数据集合（`_superusers` + 七个 JJB 业务集合，含 `event_rules`）count 与 cold 基线一致；`_migrations` 只做 id 集双向兼容检查，不混作业务 count；
- 附件文件数/字节数/抽样读取一致；
- owner 使用密码管理器中的账号做最小登录与权限 smoke；不记录明文密码或 token；
- owner 使用既有账号与既有只读页面做最小权限 smoke，不为验证新增、修改或删除生产记录；若业务另需写入验收，必须另立明确批准的生产操作契约；

### 运维门

- 新机备份目标、监控、磁盘空间和日志保留已验证；
- public manifest/恢复文档能从新机重新执行；
- 旧机继续保留在 rollback window 内，不删除数据。

---

## 10. Rollback

### 10.1 新机尚未产生生产写入

可以机械回退：

1. 冻结入口并停止新机 backend；
2. 把入口切回旧机；
3. 确认旧机仍持有原始 `pb_data` 和原配置；
4. 启动旧机 backend 并完成 deployment §6 健康检查；
5. 保留新机失败现场、日志和 cold artifact，重新开事故/迁服批次。

### 10.2 新机已经产生生产写入

**禁止直接切回旧机并继续写**，否则会丢失新写入或形成双活分叉。立即：

- 停止两端写入；
- 记录双方最后写入时间和数据基线；
- 升级为 owner 主持的数据 reconciliation 事件；
- 在新的合并/恢复方案经验证前，不自动重试 cutover。

---

## 11. 观察期与旧机下线

只有同时满足以下条件，才可申请 decommission：

- 新机稳定经过约定观察期；
- cold backup 与新机后续备份均可恢复；
- health/migration/count/附件/账号 smoke 已留私有证据；
- rollback window 已由 owner 明确关闭；
- 旧机数据保留/销毁方式获得单独批准。

本手册默认**不删除旧机、不销毁磁盘、不轮换账号密码**。账号/凭据轮换是独立安全变更；按 owner 当前决定继续暂缓，不能把“未轮换”伪装成已完成。

---

## 12. 最终搬迁 checklist

```markdown
- [ ] 明确是换电脑还是换服务器
- [ ] SOURCE_HOST / TARGET_HOST / 已批准完整 TARGET_SHA 已记录并强校验
- [ ] 若目标为公司受限 devbox，Git clone/fetch 已注入不含凭据的 shell proxy；非受限主机明确留空
- [ ] 维护、cutover、rollback owner 已确认
- [ ] 旧机只读预检和 migration 差异检查通过
- [ ] jjb-backend 已停且无写者
- [ ] 完整 pb_data cold snapshot 已生成
- [ ] archive 路径安全、SQLite quick_check、文件集与 count 对账通过
- [ ] GPG AES256 交互式加密与解密复验通过
- [ ] PRIVATE 上传与 GitHub asset digest 对账通过
- [ ] public manifest 已在独立受审变更中指向真实 cold artifact
- [ ] 新机按批准 TARGET_SHA/实际架构重新构建，并只向 TARGET_HOST 参数化传输/安装
- [ ] staging restore 全门通过且未接生产流量
- [ ] 目标 live pb_data 有 rollback copy，权限正确
- [ ] 旧机保持停服，确认只有一个写入端
- [ ] 稳定入口已切换；未重启 quick tunnel
- [ ] health / migration / count / 附件 / 登录 smoke 全绿
- [ ] 首次生产写入时间已记录
- [ ] 观察期与 rollback window 已明确
- [ ] 旧机 decommission 另获批准
```

**任何未勾选项都不是“之后再补”的提醒，而是对应阶段的停止条件。**
