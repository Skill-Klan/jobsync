#!/usr/bin/env bash
# skillklan: the copy of /data for the owner's Mac (skillklan/deploy/jobsync-backup.sh, reached
# through jobsync-deploy.sh). Requirement — D11 (the owner, 2026-11-25: «На Mac, як прод»): the
# students' data gets a copy off Server2, pulled by the Mac; it holds resumes, so only the Mac's
# key may take it, and the copy must be provably whole and restorable.
#
#   B1 the backup key gets a copy: stdout is a tar and nothing else; extracted, it is /data — the
#      database with the same rows as the live one (counted here, not taken from the lists),
#      integrity ok, every other file byte for byte; the sha256 list and the row list are right
#   B2 the backup key can do nothing else: deploy, status, any other word → refused, docker untouched
#   B3 any other key (the deploy keys) cannot take a copy — and still deploys (paired case)
#   B4 the backup key cannot be faked: no auth info, an unreadable one, no key file, another key,
#      the right key under another method, the right key plus a second one → not the backup key
#   B5 nothing is left on the server — after a copy and after a failed one
#   B6 a copy and a deploy never overlap: during a deploy a copy is refused at once; a deploy that
#      starts during a copy waits and then goes on; a copy that outlasts the wait → the deploy
#      changes nothing and says so
#   B7 the app is not running → no copy, nothing on stdout
#   B8 a write in progress is not in the copy, and the copy is not damaged by it
#
# Run: bash skillklan/tests/backup.test.sh  (Linux: flock from util-linux; Node ≥ 22.16 for node:sqlite)
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WRAPPER="${WRAPPER:-$ROOT/skillklan/deploy/jobsync-deploy.sh}"
BACKUP="${BACKUP:-$ROOT/skillklan/deploy/jobsync-backup.sh}"
FAILS=0
A="sha256:$(printf 'a%.0s' $(seq 64))"
BACKUP_PUB="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBACKUPBACKUPBACKUPBACKUPBACKUPBACKUPBACKUP jobsync-backup"
DEPLOY_PUB="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDEPLOYDEPLOYDEPLOYDEPLOYDEPLOYDEPLOYDEPLOY github-actions"
pub_of() { echo "$1" | awk '{ print $1, $2 }'; }

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# A fake docker: the app "container" is the folder $VOL standing for the volume /data; `exec`
# runs the real command (node, tar, rm) against it, so the snapshot code itself is what is tested.
setup() {
  T="$(mktemp -d)"; S="$T/state"; APP="$T/app"; BIN="$T/bin"; VOL="$T/vol"
  mkdir -p "$S" "$APP" "$BIN" "$VOL/files/resumes/u1" "$VOL/backups/u1"
  : > "$S/calls"; echo true > "$S/running"
  cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
S="$FAKE_STATE"
echo "$*" >> "$S/calls"
case "$1" in
  compose)
    shift
    while [ "${1:-}" != "" ] && [ "${1#-}" != "$1" ]; do shift 2; done
    [ "$1 $2 $3" = "ps -q app" ] && grep -q true "$S/running" && echo cid-app
    exit 0 ;;
  inspect) cat "$S/running"; exit 0 ;;
  exec)
    shift; [ "$1" = -i ] && shift; shift   # the container id
    args=(); for a in "$@"; do args+=("${a//\/data/$FAKE_VOL}"); done
    if [ "${args[0]}" = node ]; then JOBSYNC_SNAPSHOT_DATA="$FAKE_VOL" exec node "${args[@]:1}"; fi
    # A slow line to the Mac: the copy is being sent for FAKE_SLOW_SEND seconds.
    if [ "${args[0]}" = tar ] && [ -n "${FAKE_SLOW_SEND:-}" ]; then : > "$S/sending"; sleep "$FAKE_SLOW_SEND"; fi
    exec "${args[@]}" ;;
esac
exit 0
EOF
  cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
echo '{"cabinet":{"id":"cabinet","name":"SkillKlan cabinet"}}'
EOF
  chmod +x "$BIN/docker" "$BIN/curl"
  echo "$BACKUP_PUB" > "$T/backup-key.pub"
  export FAKE_STATE="$S" FAKE_VOL="$VOL" PATH="$BIN:$PATH"
  export JOBSYNC_APP_DIR="$APP" JOBSYNC_BACKUP_KEY_FILE="$T/backup-key.pub" JOBSYNC_BACKUP_BIN="$BACKUP"
  export XDG_RUNTIME_DIR="$T" DOCKER_HOST="unix://$T/docker.sock"
  # The live data: a database with rows, resumes, a person's own export.
  node --input-type=module - "$VOL/dev.db" <<'JS'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2]);
db.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY, name TEXT);
         CREATE TABLE "Job" (id INTEGER PRIMARY KEY, userId TEXT, title TEXT);`);
for (let i = 0; i < 3; i++) db.prepare('INSERT INTO "User" VALUES (?, ?)').run(`u${i}`, `Person ${i}`);
for (let i = 0; i < 250; i++) db.prepare('INSERT INTO "Job" (userId, title) VALUES (?, ?)').run(`u${i % 3}`, "x".repeat(400));
db.close();
JS
  head -c 300000 /dev/urandom > "$VOL/files/resumes/u1/cv.pdf"
  printf 'docx' > "$VOL/files/resumes/u1/cv one.docx"
  printf 'zip' > "$VOL/backups/u1/export.zip"
  : > "$VOL/dev.db-journal"
}
teardown() { rm -rf "$T"; }
# Signs in as sshd would tell it: one line per method, "publickey <type> <key>".
auth_as() { printf 'publickey %s\n' "$(pub_of "$1")" > "$T/auth"; export SSH_USER_AUTH="$T/auth"; }
run_cmd() { SSH_ORIGINAL_COMMAND="$1" bash "$WRAPPER" > "$T/out" 2> "$T/err"; echo $?; }
docker_calls() { wc -l < "$S/calls" | tr -d ' '; }
# A copy reached stdout. (jobsync-deploy prints its refusals to stdout — they go to the CI log.)
got_copy() { grep -q "backup-sha256" "$T/out" || grep -q "^exec" "$S/calls"; }
rows() { node --input-type=module - "$1" "$2" <<'JS'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[2], { readOnly: true });
console.log(db.prepare(`SELECT count(*) AS n FROM "${process.argv[3]}"`).get().n);
JS
}

# --- B1 ---------------------------------------------------------------------
setup
auth_as "$BACKUP_PUB"
rc=$(run_cmd "backup")
mkdir -p "$T/restored"
untar=0; tar -C "$T/restored" -xf "$T/out" 2> "$T/untar" || untar=1
ok=1
[ "$rc" = 0 ] && [ "$untar" = 0 ] || ok=0
[ "$(rows "$VOL/dev.db" User)" = 3 ] && [ "$(rows "$T/restored/dev.db" User)" = 3 ] || ok=0
[ "$(rows "$VOL/dev.db" Job)" = 250 ] && [ "$(rows "$T/restored/dev.db" Job)" = 250 ] || ok=0
cmp -s "$VOL/files/resumes/u1/cv.pdf" "$T/restored/files/resumes/u1/cv.pdf" || ok=0
cmp -s "$VOL/files/resumes/u1/cv one.docx" "$T/restored/files/resumes/u1/cv one.docx" || ok=0
cmp -s "$VOL/backups/u1/export.zip" "$T/restored/backups/u1/export.zip" || ok=0
[ ! -e "$T/restored/dev.db-journal" ] && [ ! -e "$T/restored/.snapshot" ] || ok=0
# Every entry of the archive is either /data's own or the two lists — nothing else got onto stdout.
extra=$(tar -tf "$T/out" | sed 's|^\./||; /^$/d' | grep -v -E '^(dev\.db|\.backup-sha256|\.backup-tables|files/?.*|backups/?.*)$' | head -3)
[ -z "$extra" ] || ok=0
# The lists: every file with its true sha256 (checked the way the Mac checks it), the true row counts.
sums_ok=$( (cd "$T/restored" && sha256sum --quiet -c .backup-sha256) > /dev/null 2>&1 && echo yes || echo no)
listed=$(cut -c67- "$T/restored/.backup-sha256" | sort | tr '\n' '|')
[ "$listed" = "backups/u1/export.zip|dev.db|files/resumes/u1/cv one.docx|files/resumes/u1/cv.pdf|" ] || sums_ok=no
manifest_ok=$([ "$sums_ok" = yes ] && [ "$(cat "$T/restored/.backup-tables")" = "$(printf 'Job\t250\nUser\t3')" ] && echo yes || echo no)
integrity=$(node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; console.log(new DatabaseSync(process.argv[1], { readOnly: true }).prepare("PRAGMA integrity_check").get().integrity_check)' "$T/restored/dev.db")
[ "$integrity" = ok ] || ok=0
if [ "$ok" = 1 ]; then pass "B1 the backup key gets the whole of /data: same rows, same files, a true manifest, stdout only the archive"
else fail "B1 copy (rc=$rc untar=$untar manifest=$manifest_ok integrity=$integrity extra=$extra)"; sed 's/^/     | /' "$T/err" "$T/untar"; fi
teardown

# --- B2 ---------------------------------------------------------------------
setup
auth_as "$BACKUP_PUB"
bad=0
for cmd in "deploy $A" "status" "backup now" "" "shell" "backup; id" "\$(id)"; do
  rc=$(run_cmd "$cmd")
  [ "$rc" != 0 ] || { bad=1; echo "     accepted: '$cmd'"; }
  [ -s "$T/out" ] && { bad=1; echo "     stdout for: '$cmd'"; }
done
[ "$(docker_calls)" = 0 ] || { bad=1; echo "     docker was called: $(head -1 "$S/calls")"; }
[ "$bad" = 0 ] && pass "B2 the backup key can only take a copy" || fail "B2 the backup key can only take a copy"
teardown

# --- B3 ---------------------------------------------------------------------
setup
auth_as "$DEPLOY_PUB"
rc=$(run_cmd "backup")
calls=$(docker_calls); got_copy && no_copy=no || no_copy=yes
rc_status=$(run_cmd "status")
if [ "$rc" != 0 ] && [ "$calls" = 0 ] && [ "$no_copy" = yes ] && [ ! -e "$VOL/.snapshot" ] && [ "$rc_status" = 0 ]; then
  pass "B3 a deploy key cannot take a copy (and still works for status)"
else fail "B3 deploy key (backup rc=$rc calls=$calls status rc=$rc_status)"; fi
teardown

# --- B4 ---------------------------------------------------------------------
setup
bad=0
try_backup() { # $1 — what was faked
  local rc; rc=$(run_cmd "backup")
  if [ "$rc" = 0 ] || got_copy; then bad=1; echo "     a copy with: $1"; fi
}
unset SSH_USER_AUTH; try_backup "no SSH_USER_AUTH"
export SSH_USER_AUTH="$T/missing"; try_backup "a missing auth file"
auth_as "$BACKUP_PUB"; chmod 000 "$T/auth"; [ -r "$T/auth" ] || try_backup "an unreadable auth file"; chmod 600 "$T/auth"
auth_as "$BACKUP_PUB"; export JOBSYNC_BACKUP_KEY_FILE="$T/none"; try_backup "no key file"
: > "$T/empty.pub"; export JOBSYNC_BACKUP_KEY_FILE="$T/empty.pub"; try_backup "an empty key file"
echo "$DEPLOY_PUB" > "$T/other.pub"; export JOBSYNC_BACKUP_KEY_FILE="$T/other.pub"; try_backup "another key in the key file"
export JOBSYNC_BACKUP_KEY_FILE="$T/backup-key.pub"
printf 'keyboard-interactive %s\n' "$(pub_of "$BACKUP_PUB")" > "$T/auth"; try_backup "the key under another method"
printf 'publickey %s\npublickey %s\n' "$(pub_of "$DEPLOY_PUB")" "$(pub_of "$BACKUP_PUB")" > "$T/auth"; try_backup "two keys"
printf 'publickey %s extra\n' "$(pub_of "$BACKUP_PUB")" > "$T/auth"; try_backup "trailing words"
[ "$(docker_calls)" = 0 ] || { bad=1; echo "     docker was called"; }
# Paired case: the same setup with the true key does take a copy.
auth_as "$BACKUP_PUB"; rc=$(run_cmd "backup"); [ "$rc" = 0 ] && [ -s "$T/out" ] || { bad=1; echo "     the true key got no copy"; }
[ "$bad" = 0 ] && pass "B4 the backup key cannot be faked" || fail "B4 the backup key cannot be faked"
teardown

# --- B5 ---------------------------------------------------------------------
setup
auth_as "$BACKUP_PUB"
rc_ok=$(run_cmd "backup"); left_ok=$([ -e "$VOL/.snapshot" ] && echo yes || echo no)
echo "not a database" > "$VOL/dev.db"
rc_bad=$(run_cmd "backup"); left_bad=$([ -e "$VOL/.snapshot" ] && echo yes || echo no)
if [ "$rc_ok" = 0 ] && [ "$left_ok" = no ] && [ "$rc_bad" != 0 ] && [ "$left_bad" = no ] && [ ! -s "$T/out" ]; then
  pass "B5 nothing left on the server, after a copy and after a failed one (and a failed one sends nothing)"
else fail "B5 cleanup (ok: rc=$rc_ok left=$left_ok; failed: rc=$rc_bad left=$left_bad)"; sed 's/^/     | /' "$T/err"; fi
teardown

# --- B6 ---------------------------------------------------------------------
setup
# a) during a deploy → a copy is refused at once
auth_as "$BACKUP_PUB"
( flock -x 9; : > "$T/held"; /bin/sleep 5 ) 9>"$APP/.deploy.lock" &
holder=$!
for _ in $(seq 1 100); do [ -e "$T/held" ] && break; /bin/sleep 0.05; done
start=$SECONDS; rc_a=$(run_cmd "backup"); took_a=$((SECONDS - start)); calls_a=$(docker_calls)
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null; rm -f "$T/held"
# b) a deploy started while a real copy is being sent waits for it, then goes on (the same
#    digest, healthy → no-op)
echo "JOBSYNC_DIGEST=$A" > "$APP/.env"; : > "$APP/app.env"; sha256sum "$APP/app.env" | cut -d' ' -f1 > "$APP/.app.env.sha256"
( export FAKE_SLOW_SEND=3; SSH_ORIGINAL_COMMAND=backup bash "$WRAPPER" > "$T/copy.tar" 2> "$T/copy.err"; echo $? > "$T/copy.rc" ) &
copier=$!
for _ in $(seq 1 200); do [ -e "$S/sending" ] && break; /bin/sleep 0.05; done
auth_as "$DEPLOY_PUB"
export JOBSYNC_BACKUP_WAIT_S=20
start=$SECONDS; rc_b=$(run_cmd "deploy $A"); took_b=$((SECONDS - start))
grep -q "nothing to do" "$T/out" && b_out=yes || b_out=no
wait "$copier" 2>/dev/null
[ "$(cat "$T/copy.rc" 2>/dev/null)" = 0 ] && grep -q backup-sha256 "$T/copy.tar" && b_copy=yes || b_copy=no
# c) a copy that outlasts the wait → the deploy changes nothing and says so
( flock -x 8; : > "$T/held"; /bin/sleep 6 ) 8>"$APP/.backup.lock" &
holder=$!
for _ in $(seq 1 100); do [ -e "$T/held" ] && break; /bin/sleep 0.05; done
: > "$S/calls"
export JOBSYNC_BACKUP_WAIT_S=1
rc_c=$(run_cmd "deploy $A"); calls_c=$(docker_calls); unset JOBSYNC_BACKUP_WAIT_S
grep -q "still being taken" "$T/out" && c_out=yes || c_out=no
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
if [ "$rc_a" != 0 ] && [ "$took_a" -le 1 ] && [ "$calls_a" = 0 ] \
   && [ -e "$S/sending" ] && [ "$rc_b" = 0 ] && [ "$took_b" -ge 1 ] && [ "$b_out" = yes ] && [ "$b_copy" = yes ] \
   && [ "$rc_c" != 0 ] && [ "$c_out" = yes ] && [ "$calls_c" = 0 ] && [ "$(sed -n 's/^JOBSYNC_DIGEST=//p' "$APP/.env")" = "$A" ]; then
  pass "B6 a copy and a deploy never overlap; a deploy waits for a copy instead of failing"
else fail "B6 locks (a: rc=$rc_a took=$took_a calls=$calls_a; b: rc=$rc_b took=$took_b out=$b_out copy=$b_copy; c: rc=$rc_c out=$c_out calls=$calls_c)"; fi
teardown

# --- B7 ---------------------------------------------------------------------
setup
auth_as "$BACKUP_PUB"
echo false > "$S/running"
rc=$(run_cmd "backup")
if [ "$rc" != 0 ] && [ ! -s "$T/out" ] && ! grep -q "exec" "$S/calls"; then pass "B7 the app is not running → no copy"
else fail "B7 app not running (rc=$rc)"; fi
teardown

# --- B8 ---------------------------------------------------------------------
setup
auth_as "$BACKUP_PUB"
# A writer in the middle of a transaction big enough to spill into the database file: it holds
# the exclusive lock and the file on disk is half-written. A plain file copy now would be broken;
# the online backup waits for the lock (busy timeout) and copies the database as committed.
node --input-type=module - "$VOL/dev.db" "$T/writing" <<'JS' &
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
const db = new DatabaseSync(process.argv[2]);
db.exec("PRAGMA cache_size = 1; BEGIN IMMEDIATE");
for (let i = 0; i < 1000; i++) db.prepare('INSERT INTO "Job" (userId, title) VALUES (?, ?)').run("u0", "y".repeat(400));
fs.writeFileSync(process.argv[3], "");
const until = Date.now() + 2500; while (Date.now() < until) { /* hold the transaction */ }
db.exec("ROLLBACK");
JS
writer=$!
for _ in $(seq 1 200); do [ -e "$T/writing" ] && break; /bin/sleep 0.05; done
# The writer really holds the file: a reader with no patience is turned away.
locked=$(node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; try { new DatabaseSync(process.argv[1], { readOnly: true, timeout: 0 }).prepare("SELECT count(*) FROM Job").get(); console.log("no") } catch { console.log("yes") }' "$VOL/dev.db")
rc=$(run_cmd "backup")
wait "$writer" 2>/dev/null
mkdir -p "$T/restored"; tar -C "$T/restored" -xf "$T/out" 2>/dev/null
jobs_in_copy=$(rows "$T/restored/dev.db" Job 2>/dev/null)
integrity=$(node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; console.log(new DatabaseSync(process.argv[1], { readOnly: true }).prepare("PRAGMA integrity_check").get().integrity_check)' "$T/restored/dev.db" 2>/dev/null)
if [ "$locked" = yes ] && [ "$rc" = 0 ] && [ "$jobs_in_copy" = 250 ] && [ "$integrity" = ok ]; then
  pass "B8 a write in progress is not in the copy, and the copy is whole"
else fail "B8 copy during a write (locked=$locked rc=$rc jobs=$jobs_in_copy integrity=$integrity)"; sed 's/^/     | /' "$T/err"; fi
teardown

echo "---- $FAILS failed"
[ "$FAILS" -eq 0 ]
