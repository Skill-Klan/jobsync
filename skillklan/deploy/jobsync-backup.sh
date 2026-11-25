#!/usr/bin/env bash
# skillklan: a copy of /data (SQLite and the students' resumes) for the owner's Mac (D11).
# Installed as /usr/local/bin/jobsync-backup, owned by root; runs as svc-jobsync.
#
#   backup   writes a tar of /data to stdout, taken without stopping the app
#
# Only jobsync-deploy starts it, and only for the backup key (/etc/jobsync/backup-key.pub,
# checked there through sshd's ExposeAuthInfo): the deploy keys never reach this script, and
# the backup key reaches nothing else. The Mac pulls; the server holds no way into the Mac.
#
# What the archive holds — the layout of /data itself, so it restores by plain extraction:
#   dev.db              the database through SQLite's online backup (consistent while the app
#                       writes), checked with PRAGMA integrity_check before it is sent
#   files/…, backups/…  every other file as it is (a hard link, so a file the app rewrites
#                       meanwhile does not change the copy)
#   .backup-sha256      sha256 of every file above, in `shasum -c` format
#   .backup-tables      "<table>\t<rows>" for every table of dev.db
# The receiver proves the copy complete by the last two (stock tools: shasum, sqlite3), not by
# its size.
#
# stdout carries the archive and nothing else; every message goes to stderr. Nothing is left on
# the server: the staging folder /data/.snapshot is removed after success and after a failure.
#
# A deploy and a copy never overlap: a copy is refused while a deploy runs (it may be restoring
# /data), and a deploy that starts during a copy waits for it (jobsync-deploy, .backup.lock).
set -euo pipefail
umask 077

APP_DIR="${JOBSYNC_APP_DIR:-$HOME/jobsync}"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DOCKER_HOST="${DOCKER_HOST:-unix://$XDG_RUNTIME_DIR/docker.sock}"

say() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() { say "FAIL: $*"; exit 1; }

# The command comes from SSH (the forced command) or from the arguments (tests). Not echoed back.
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-$*}"
[ "${#args[@]}" -eq 1 ] && [ "${args[0]}" = backup ] || die "allowed: 'backup'"

cd "$APP_DIR" || die "no $APP_DIR"
# Take the deploy lock only to make sure no deploy is running, hold the copy's own lock, then
# let the deploy lock go: a deploy that starts now waits for .backup.lock instead of failing.
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || die "a deploy is running — try again later"
exec 8>"$APP_DIR/.backup.lock"
flock -n 8 || die "another copy is being taken"
exec 9>&-

compose() { docker compose --project-directory "$APP_DIR" -f "$APP_DIR/compose.yaml" "$@"; }
cid="$(compose ps -q app 2> /dev/null || true)"
[ -n "$cid" ] && [ "$(docker inspect -f '{{.State.Running}}' "$cid" 2> /dev/null)" = true ] \
  || die "the app is not running — no copy"

cleanup() { docker exec "$cid" rm -rf /data/.snapshot > /dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 1' HUP INT TERM PIPE

# Runs inside the app container (its own Node, its own user): no SQLite tools on the host.
snapshot_js() {
  cat <<'JS'
import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA = process.env.JOBSYNC_SNAPSHOT_DATA || "/data";
const OUT = path.join(DATA, ".snapshot");
const DB = "dev.db";
// The live database and its side files are never copied as files: only through backup().
const SKIP = new Set([DB, `${DB}-journal`, `${DB}-wal`, `${DB}-shm`, ".snapshot"]);
const fail = (m) => { console.error(`snapshot: ${m}`); process.exit(1); };
function sha256(file) {
  const h = createHash("sha256");
  const buf = Buffer.alloc(1 << 20);
  const fd = fs.openSync(file, "r");
  try { for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest("hex");
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { mode: 0o700 });
if (!fs.existsSync(path.join(DATA, DB))) fail(`no ${DB}`);

const live = new DatabaseSync(path.join(DATA, DB), { readOnly: true, timeout: 10000 }); // waits out a commit
await backup(live, path.join(OUT, DB));
live.close();
fs.chmodSync(path.join(OUT, DB), fs.statSync(path.join(DATA, DB)).mode & 0o777); // the live file's mode

const copy = new DatabaseSync(path.join(OUT, DB), { readOnly: true });
const check = copy.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
if (check.length !== 1 || check[0] !== "ok") fail("integrity_check of the copy is not ok");
const tables = {};
for (const { name } of copy.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
  tables[name] = Number(copy.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"', '""')}"`).get().n);
}
copy.close();

const files = [];
function walk(rel) {
  for (const e of fs.readdirSync(path.join(DATA, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (!rel && SKIP.has(e.name)) continue;
    // The app strips both from names (getTimestampedFileName); they would break the list.
    if (/[\x00-\x1f\x7f\\]/.test(r)) fail("a file name with a control character or a backslash");
    if (e.isDirectory()) { fs.mkdirSync(path.join(OUT, r)); walk(r); continue; }
    if (!e.isFile()) fail("not a file or a folder in /data");
    try { fs.linkSync(path.join(DATA, r), path.join(OUT, r)); }
    catch (err) { if (err.code === "ENOENT") continue; throw err; } // deleted meanwhile: not in the copy
    files.push(r);
  }
}
walk("");

const dbBytes = fs.statSync(path.join(OUT, DB)).size;
const sums = [DB, ...files].map((f) => `${sha256(path.join(OUT, f))}  ${f}\n`).join("");
fs.writeFileSync(path.join(OUT, ".backup-sha256"), sums, { mode: 0o600 });
fs.writeFileSync(path.join(OUT, ".backup-tables"),
  Object.entries(tables).map(([t, n]) => `${t}\t${n}\n`).join(""), { mode: 0o600 });
fs.chmodSync(OUT, fs.statSync(DATA).mode & 0o777); // restores /data with its own mode
console.error(`snapshot: ${DB} ${dbBytes} bytes, ${Object.keys(tables).length} tables, ${files.length} files`);
JS
}

say "copy of /data: snapshot"
snapshot_js | docker exec -i "$cid" node --input-type=module - 1>&2 || die "the snapshot failed — nothing sent"
say "copy of /data: sending"
docker exec "$cid" tar -C /data/.snapshot -cf - . || die "sending the copy failed"
say "OK: copy of /data sent"
