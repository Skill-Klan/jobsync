#!/usr/bin/env bash
# skillklan: smoke-тест образу JobSync — перевіряє ВИМОГИ, а не реалізацію.
#
#   R1  стартує без мережі (жодних завантажень під час старту)
#   R2  образ стартує НЕ від root: Config.User = 1001 і PID 1 — uid 1001
#       (апстрім стартує від root і лише потім робить su — PID 1 після su теж 1001,
#        тому дивитись лише на PID 1 мало: це хибно-зелене)
#   R3  міграції застосовано: /data/dev.db існує й не порожній
#   R4  плейсхолдер AUTH_SECRET → контейнер НЕ працює (fail closed)
#   R5  порожній ENCRYPTION_KEY  → контейнер НЕ працює (fail closed)
#
# Використання: skillklan/tests/image-smoke.sh <image>
# Код виходу: 0 — усі вимоги виконано, 1 — хоч одна ні.
# Контрольна перевірка самого тесту (CI, job smoke-is-not-vacuous): на образі апстріму
# цей скрипт МУСИТЬ падати — інакше він нічого не перевіряє.
set -u

IMAGE="${1:?usage: image-smoke.sh <image>}"
PREFIX="sk-smoke-$$"
FAILS=0
# Випадкові тестові значення: справжні секрети тут не потрібні й не використовуються.
SECRET_A="$(head -c 32 /dev/urandom | base64)"
SECRET_B="$(head -c 32 /dev/urandom | base64)"

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }
cleanup() { docker rm -f "$PREFIX-ok" "$PREFIX-ph" "$PREFIX-nokey" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Чи працює контейнер через $2 секунд (true/false).
running_after() {
  local name="$1" secs="$2" i
  for i in $(seq 1 "$secs"); do sleep 1; done
  [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" = "true" ]
}

# --- R2 (статично): користувач, з яким стартує образ ---------------------------
cfg_user=$(docker image inspect -f '{{.Config.User}}' "$IMAGE" 2>/dev/null)
case "$cfg_user" in
  1001 | 1001:*) pass "R2a image Config.User is 1001 ($cfg_user)" ;;
  *) fail "R2a image Config.User is 1001 (got '${cfg_user:-<empty = root>}')" ;;
esac

# --- R1, R2, R3: справжні секрети, без мережі -------------------------------
docker run -d --name "$PREFIX-ok" --network none \
  -e AUTH_SECRET="$SECRET_A" -e ENCRYPTION_KEY="$SECRET_B" \
  -e NEXTAUTH_URL="http://localhost:3737" -e AUTH_TRUST_HOST=true \
  -e DATABASE_URL="file:/data/dev.db" -e TZ=Europe/Kyiv -e MCP_ENABLED=false \
  "$IMAGE" >/dev/null

healthy=false
for i in $(seq 1 120); do
  if [ "$(docker inspect -f '{{.State.Running}}' "$PREFIX-ok" 2>/dev/null)" != "true" ]; then break; fi
  if docker exec "$PREFIX-ok" wget -q -O /dev/null http://127.0.0.1:3737/ 2>/dev/null; then healthy=true; break; fi
  sleep 1
done
if $healthy; then pass "R1 starts and serves with --network none"
else fail "R1 starts and serves with --network none"; docker logs --tail 15 "$PREFIX-ok" 2>&1 | sed 's/^/     | /'; fi

if $healthy; then
  uid=$(docker exec "$PREFIX-ok" awk '/^Uid:/{print $2}' /proc/1/status 2>/dev/null)
  [ "$uid" = "1001" ] && pass "R2b PID 1 runs as uid 1001" || fail "R2b PID 1 runs as uid 1001 (got '${uid:-?}')"
  size=$(docker exec "$PREFIX-ok" sh -c 'stat -c %s /data/dev.db 2>/dev/null || echo 0')
  [ "${size:-0}" -gt 0 ] && pass "R3 migrations applied (/data/dev.db ${size} bytes)" || fail "R3 migrations applied (/data/dev.db missing or empty)"
else
  fail "R2b PID 1 runs as uid 1001 (not reached: R1 failed)"
  fail "R3 migrations applied (not reached: R1 failed)"
fi

# --- R4, R5: мережа є (щоб падіння було саме через секрет, а не через мережу) --
docker run -d --name "$PREFIX-ph" \
  -e AUTH_SECRET="your-auth-secret" -e ENCRYPTION_KEY="$SECRET_B" \
  -e NEXTAUTH_URL="http://localhost:3737" -e DATABASE_URL="file:/data/dev.db" \
  "$IMAGE" >/dev/null
if running_after "$PREFIX-ph" 45; then fail "R4 placeholder AUTH_SECRET refused (container still running)"
else pass "R4 placeholder AUTH_SECRET refused"; fi

docker run -d --name "$PREFIX-nokey" \
  -e AUTH_SECRET="$SECRET_A" -e ENCRYPTION_KEY="" \
  -e NEXTAUTH_URL="http://localhost:3737" -e DATABASE_URL="file:/data/dev.db" \
  "$IMAGE" >/dev/null
if running_after "$PREFIX-nokey" 45; then fail "R5 empty ENCRYPTION_KEY refused (container still running)"
else pass "R5 empty ENCRYPTION_KEY refused"; fi

echo "---- $FAILS failed"
[ "$FAILS" -eq 0 ]
