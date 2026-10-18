#!/usr/bin/env bash
# skillklan: тест обгортки деплою (skillklan/deploy/jobsync-deploy.sh) — перевіряє ВИМОГИ:
#
#   W1  ключ деплою вміє лише «deploy sha256:<64 hex>» і «status»: тег, обрізаний digest,
#       хвіст після digest, підстановка команд, зайві слова — відмова ДО будь-якого docker
#   W2  перший деплой: pull за digest, digest у .env, up, здоровий → успіх, копії даних немає
#   W3  оновлення: стара версія зупинена, копія /data знята ДО зміни digest і ДО up нової
#   W4  pull не вдався → нічого не змінено: digest старий, стара версія не зупинялась
#   W5  нова версія нездорова → дані повернуто з копії, digest старий, стара версія знову працює
#   W6  копія /data не вдалась → digest старий, стара версія знову запущена, нова не стартувала
#   W7  два деплої одночасно → другий відмовляє одразу, docker не чіпає
#   W8  той самий digest і здоровий → нічого не робить
#   W9  копій даних лишається не більше JOBSYNC_KEEP_BACKUPS, найновіші
#   W10 логи застосунку назовні не йдуть (вивід обгортки потрапляє в публічний лог CI)
#   W11 app.env змінили (новий ключ, теки) → той самий digest розгортається наново, з
#       копією /data — контейнер читає app.env лише при створенні; не змінили → як W8
#
# Запуск: bash skillklan/tests/deploy-wrapper.test.sh  (Linux: потрібен flock з util-linux)
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WRAPPER="${WRAPPER:-$ROOT/skillklan/deploy/jobsync-deploy.sh}"
FAILS=0
A="sha256:$(printf 'a%.0s' $(seq 64))"
B="sha256:$(printf 'b%.0s' $(seq 64))"

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# Фейкове оточення: docker і curl — скрипти, стан — файли в тимчасовій теці.
#   $S/running  — digest, що зараз працює (порожньо — нічого)
#   $S/data     — «вміст тому /data»
#   $S/calls    — журнал викликів docker
#   HEALTHY     — digest-и, які відповідають здоровим (через пробіл)
#   PULL_FAILS  — digest-и, що не тягнуться;  BACKUP_FAILS=1 — tar копії падає
setup() {
  T="$(mktemp -d)"; S="$T/state"; APP="$T/app"; BIN="$T/bin"
  mkdir -p "$S" "$APP" "$BIN"
  : > "$S/calls"; : > "$S/running"; echo "v1-data" > "$S/data"
  cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
S="$FAKE_STATE"
echo "$*" >> "$S/calls"
img_digest() { for a in "$@"; do case "$a" in *@sha256:*) echo "${a#*@}"; return;; esac; done; }
case "$1" in
  pull)
    d="$(img_digest "$@")"
    for f in $PULL_FAILS; do [ "$f" = "$d" ] && exit 1; done
    exit 0 ;;
  run)
    args="$*"
    case "$args" in
      *"-cf /backup/"*)
        [ "${BACKUP_FAILS:-0}" = 1 ] && exit 1
        name="${args##*-cf /backup/}"; name="${name%% *}"
        cp "$S/data" "$FAKE_APP/backups/$name" ;;
      *"-xpf"*)
        name="${args##*/backup/}"; name="${name%% *}"
        cp "$FAKE_APP/backups/$name" "$S/data" ;;
    esac
    exit 0 ;;
  compose)
    shift
    while [ "${1:-}" != "" ] && [ "${1#-}" != "$1" ]; do shift 2; done
    case "$1" in
      stop) : > "$S/running" ;;
      start) [ -s "$S/last" ] && cp "$S/last" "$S/running" ;;
      up)
        d="$(sed -n 's/^JOBSYNC_DIGEST=//p' "$FAKE_APP/.env")"
        echo "$d" > "$S/running"; echo "$d" > "$S/last"
        # нова версія «мігрує» дані — щоб було видно, що відкат їх повертає
        [ "$d" = "$MIGRATING_DIGEST" ] && echo "migrated-by-$d" > "$S/data"
        ;;
      logs) echo "APP-LOG-LINE with user data" ;;
    esac
    exit 0 ;;
esac
exit 0
EOF
  cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
r="$(cat "$FAKE_STATE/running")"
for h in $HEALTHY; do
  if [ -n "$r" ] && [ "$h" = "$r" ]; then echo '{"cabinet":{"id":"cabinet","name":"SkillKlan cabinet"}}'; exit 0; fi
done
exit 7
EOF
  cat > "$BIN/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$BIN/docker" "$BIN/curl" "$BIN/sleep"
  export FAKE_STATE="$S" FAKE_APP="$APP" PATH="$BIN:$PATH"
  export JOBSYNC_APP_DIR="$APP" JOBSYNC_HEALTH_TIMEOUT_S=2 JOBSYNC_KEEP_BACKUPS=3
  export HEALTHY="" PULL_FAILS="" BACKUP_FAILS=0 MIGRATING_DIGEST=""
  export XDG_RUNTIME_DIR="$T" DOCKER_HOST="unix://$T/docker.sock"
}
teardown() { rm -rf "$T"; }
run_wrapper() { SSH_ORIGINAL_COMMAND="$1" bash "$WRAPPER" > "$T/out" 2>&1; echo $?; }
digest_in_env() { sed -n 's/^JOBSYNC_DIGEST=//p' "$APP/.env" 2>/dev/null; }
running_with() { echo "JOBSYNC_DIGEST=$1" > "$APP/.env"; echo "$1" > "$S/running"; echo "$1" > "$S/last"; }

# --- W1 ---------------------------------------------------------------------
setup
bad=0
for cmd in "deploy latest" "deploy sk-0.2.0" "deploy sha256:abc" "deploy ${A}0" "deploy ${A^^}" \
           "deploy $A; rm -rf /" "deploy \$(id)" "deploy $A extra" "deploy" "" "shell" "status now" \
           "deploy ghcr.io/skill-klan/jobsync@$A"; do
  rc=$(run_wrapper "$cmd")
  [ "$rc" != 0 ] || { bad=1; echo "     accepted: '$cmd'"; }
done
[ -s "$S/calls" ] && { bad=1; echo "     docker was called: $(head -1 "$S/calls")"; }
[ "$bad" = 0 ] && pass "W1 only 'deploy <digest>' and 'status' are accepted" || fail "W1 only 'deploy <digest>' and 'status' are accepted"
teardown

# --- W2 ---------------------------------------------------------------------
setup
HEALTHY="$A"
rc=$(run_wrapper "deploy $A")
if [ "$rc" = 0 ] && [ "$(digest_in_env)" = "$A" ] && grep -q "pull -q ghcr.io/skill-klan/jobsync@$A" "$S/calls" \
   && ! grep -q -- "-cf /backup/" "$S/calls"; then pass "W2 first deploy"
else fail "W2 first deploy (rc=$rc, env=$(digest_in_env))"; sed 's/^/     | /' "$T/out"; fi
teardown

# --- W3 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A $B"
rc=$(run_wrapper "deploy $B")
stop_line=$(grep -n "compose.* stop" "$S/calls" | head -1 | cut -d: -f1)
backup_line=$(grep -n -- "-cf /backup/" "$S/calls" | head -1 | cut -d: -f1)
up_line=$(grep -n "compose.* up" "$S/calls" | head -1 | cut -d: -f1)
backups=$(ls "$APP/backups" 2>/dev/null | wc -l | tr -d ' ')
if [ "$rc" = 0 ] && [ "$(digest_in_env)" = "$B" ] && [ -n "$stop_line" ] && [ -n "$backup_line" ] && [ -n "$up_line" ] \
   && [ "$stop_line" -lt "$backup_line" ] && [ "$backup_line" -lt "$up_line" ] && [ "$backups" = 1 ] \
   && grep -q "v1-data" "$APP"/backups/*; then pass "W3 upgrade: stop → copy /data → new digest → up"
else fail "W3 upgrade (rc=$rc stop=$stop_line backup=$backup_line up=$up_line backups=$backups)"; sed 's/^/     | /' "$T/out"; fi
teardown

# --- W4 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A $B"; PULL_FAILS="$B"
rc=$(run_wrapper "deploy $B")
if [ "$rc" != 0 ] && [ "$(digest_in_env)" = "$A" ] && [ "$(cat "$S/running")" = "$A" ] && ! grep -q "compose.* stop" "$S/calls"; then
  pass "W4 pull failed → nothing changed"
else fail "W4 pull failed (rc=$rc env=$(digest_in_env) running=$(cat "$S/running"))"; fi
teardown

# --- W5 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A"; MIGRATING_DIGEST="$B"
rc=$(run_wrapper "deploy $B")
if [ "$rc" != 0 ] && [ "$(digest_in_env)" = "$A" ] && [ "$(cat "$S/running")" = "$A" ] && [ "$(cat "$S/data")" = "v1-data" ] \
   && grep -qi "rolled back" "$T/out"; then pass "W5 unhealthy new version → old digest AND old data back"
else fail "W5 rollback (rc=$rc env=$(digest_in_env) running=$(cat "$S/running") data=$(cat "$S/data"))"; sed 's/^/     | /' "$T/out"; fi
teardown

# --- W6 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A $B"; BACKUP_FAILS=1
rc=$(run_wrapper "deploy $B")
if [ "$rc" != 0 ] && [ "$(digest_in_env)" = "$A" ] && [ "$(cat "$S/running")" = "$A" ] && ! grep -q "compose.* up" "$S/calls"; then
  pass "W6 copy of /data failed → old version back, new never started"
else fail "W6 backup failed (rc=$rc env=$(digest_in_env) running=$(cat "$S/running"))"; sed 's/^/     | /' "$T/out"; fi
teardown

# --- W7 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A $B"
# справжній /bin/sleep: фейковий у PATH повертається одразу й відпустив би замок
( flock -x 9; : > "$T/held"; /bin/sleep 5 ) 9>"$APP/.deploy.lock" &
holder=$!
for _ in $(seq 1 100); do [ -e "$T/held" ] && break; /bin/sleep 0.05; done
rc=$(run_wrapper "deploy $B")
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
if [ "$rc" != 0 ] && [ ! -s "$S/calls" ] && [ "$(digest_in_env)" = "$A" ]; then pass "W7 a second deploy at the same time is refused"
else fail "W7 concurrent deploy (rc=$rc calls=$(wc -l < "$S/calls"))"; fi
teardown

# --- W8 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A"
rc=$(run_wrapper "deploy $A")
if [ "$rc" = 0 ] && [ ! -s "$S/calls" ]; then pass "W8 same digest and healthy → no-op"
else fail "W8 no-op (rc=$rc calls=$(wc -l < "$S/calls"))"; fi
teardown

# --- W9 ---------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A $B"
mkdir -p "$APP/backups"
for i in 1 2 3 4 5; do echo old > "$APP/backups/data-2026010${i}T000000Z-aaaaaaaaaaaa.tar"; touch -d "2026-01-0$i" "$APP/backups/data-2026010${i}T000000Z-aaaaaaaaaaaa.tar"; done
rc=$(run_wrapper "deploy $B")
left=$(ls "$APP/backups" | wc -l | tr -d ' ')
newest_kept=$(find "$APP/backups" -maxdepth 1 -name 'data-*' ! -name 'data-2026010*' | wc -l | tr -d ' ')
if [ "$rc" = 0 ] && [ "$left" = 3 ] && [ "$newest_kept" = 1 ] && [ -e "$APP/backups/data-20260105T000000Z-aaaaaaaaaaaa.tar" ] \
   && [ ! -e "$APP/backups/data-20260101T000000Z-aaaaaaaaaaaa.tar" ]; then pass "W9 keeps only the newest copies"
else fail "W9 prune (rc=$rc left=$left new=$newest_kept)"; ls "$APP/backups" | sed 's/^/     | /'; fi
teardown

# --- W10 --------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A"
rc=$(run_wrapper "deploy $B")
if ! grep -q "APP-LOG-LINE" "$T/out" && ! grep -q "compose.* logs" "$S/calls"; then pass "W10 app logs never leave the server"
else fail "W10 app logs leaked into the output"; fi
teardown

# --- W11 --------------------------------------------------------------------
setup
running_with "$A"; HEALTHY="$A"
echo "INTERVIEW_RECORDINGS_FOLDER_QA_TECH=one" > "$APP/app.env"
redeployed() { grep -q "compose.* stop" "$S/calls" && grep -q -- "-cf /backup/" "$S/calls" && grep -q "compose.* up" "$S/calls"; }
# a) так на сервері після встановлення цієї обгортки: app.env дописано, відбитка ще немає
rc_a=$(run_wrapper "deploy $A"); redeployed && a=yes || a=no
# b) одразу ще раз, нічого не міняли
: > "$S/calls"; rc_b=$(run_wrapper "deploy $A"); calls_b=$(wc -l < "$S/calls" | tr -d ' ')
# c) замінили ключ / теку
echo "INTERVIEW_RECORDINGS_FOLDER_QA_TECH=two" > "$APP/app.env"
: > "$S/calls"; rc_c=$(run_wrapper "deploy $A"); redeployed && c=yes || c=no
if [ "$rc_a" = 0 ] && [ "$a" = yes ] && [ "$rc_b" = 0 ] && [ "$calls_b" = 0 ] && [ "$rc_c" = 0 ] && [ "$c" = yes ] \
   && [ "$(digest_in_env)" = "$A" ] && ! grep -q "one\|two" "$T/out"; then
  pass "W11 app.env changed → same digest redeployed with a copy of /data; unchanged → no-op"
else fail "W11 app.env reload (a: rc=$rc_a $a; b: rc=$rc_b calls=$calls_b; c: rc=$rc_c $c)"; sed 's/^/     | /' "$T/out"; fi
teardown

echo "---- $FAILS failed"
[ "$FAILS" -eq 0 ]
