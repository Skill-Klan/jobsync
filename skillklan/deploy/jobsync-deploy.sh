#!/usr/bin/env bash
# skillklan: єдине, що може запустити ключ деплою на Server2 (примусова команда в
# ~svc-jobsync/.ssh/authorized_keys і `ForceCommand` у sshd). Ставиться як
# /usr/local/bin/jobsync-deploy, власник root; виконується від svc-jobsync.
#
#   deploy sha256:<64 hex>   перемкнути SkillKlan Job на образ із цим digest
#   status                   який digest працює і чи він здоровий
#
# Лише digest, ніколи тег: на сервер іде рівно той образ, що пройшов smoke у CI.
# Перед заміною — копія тому /data (SQLite і резюме), знята при зупиненій старій
# версії. Нова не піднялась здоровою → назад попередній digest РАЗОМ із копією:
# міграції Prisma нової версії вже змінили схему, і старий код зі зміненою базою
# не працює.
#
# Вивід іде в лог GitHub Actions, а репозиторій публічний: логів застосунку тут
# не друкуємо — там можуть бути дані студентів. Дивитись їх — на сервері.
set -euo pipefail
umask 027

APP_DIR="${JOBSYNC_APP_DIR:-$HOME/jobsync}"
REPO="${JOBSYNC_IMAGE_REPO:-ghcr.io/skill-klan/jobsync}"
HEALTH_URL="${JOBSYNC_HEALTH_URL:-http://127.0.0.1:3737/api/auth/providers}"
HEALTH_TIMEOUT_S="${JOBSYNC_HEALTH_TIMEOUT_S:-180}"
KEEP_BACKUPS="${JOBSYNC_KEEP_BACKUPS:-10}"
VOLUME="jobsync_data"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DOCKER_HOST="${DOCKER_HOST:-unix://$XDG_RUNTIME_DIR/docker.sock}"

say() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { say "FAIL: $*"; exit 1; }

# Команда — з SSH (примусова команда) або з аргументів (тести, svc-jobsync руками).
# Сам рядок назад не друкуємо: це чужий ввід.
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-$*}"
digest=""
case "${args[0]:-}" in
  deploy)
    [ "${#args[@]}" -eq 2 ] || die "usage: deploy sha256:<64 hex>"
    digest="${args[1]}"
    [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "not an image digest — refusing (tags are not deployed)"
    ;;
  status)
    [ "${#args[@]}" -eq 1 ] || die "usage: status"
    ;;
  *)
    die "allowed: 'deploy sha256:<64 hex>' or 'status'"
    ;;
esac

cd "$APP_DIR" || die "no $APP_DIR"
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || die "another deploy is running"

compose() { docker compose --project-directory "$APP_DIR" -f "$APP_DIR/compose.yaml" "$@"; }
# Першого деплою .env ще немає — це «нічого не працює», а не помилка.
current_digest() { [ -f .env ] || return 0; sed -n 's/^JOBSYNC_DIGEST=//p' .env | head -n 1; }
set_digest() { printf 'JOBSYNC_DIGEST=%s\n' "$1" > .env.tmp && mv -f .env.tmp .env; }
healthy() { curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q '"id":"cabinet"'; }
# Лишаємо KEEP_BACKUPS найновіших копій; ім'я починається з UTC-часу, тож порядок — за іменем.
prune_backups() {
  [ -d backups ] || return 0
  find backups -maxdepth 1 -type f -name 'data-*.tar' -printf '%f\n' | sort -r \
    | tail -n +"$((KEEP_BACKUPS + 1))" | sed 's|^|backups/|' | xargs -r rm -f
}
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_S))
  while [ "$SECONDS" -lt "$deadline" ]; do
    healthy && return 0
    sleep 3
  done
  return 1
}

if [ "${args[0]}" = status ]; then
  d="$(current_digest)"
  say "digest: ${d:-none}"
  if healthy; then say "health: ok"; else say "health: FAIL"; exit 1; fi
  exit 0
fi

old="$(current_digest)"
if [ "$old" = "$digest" ] && healthy; then
  say "already running $digest and healthy — nothing to do"
  exit 0
fi

say "pulling $REPO@$digest"
docker pull -q "$REPO@$digest" > /dev/null || die "pull failed — nothing changed"

backup=""
if [ -n "$old" ]; then
  say "stopping $old"
  compose stop -t 30 app > /dev/null
  mkdir -p backups
  backup="data-$(date -u +%Y%m%dT%H%M%SZ)-${old:7:12}.tar"
  # Копію знімає старий образ (він уже є локально) від root контейнера — у rootless
  # Docker це сам svc-jobsync, а файли тому належать uid 1001 контейнера.
  if ! docker run --rm --user 0 --network none \
        -v "$VOLUME:/data:ro" -v "$APP_DIR/backups:/backup" \
        --entrypoint tar "$REPO@$old" -C /data -cf "/backup/$backup" . \
     || [ ! -s "backups/$backup" ]; then
    rm -f "backups/$backup"
    compose start app > /dev/null || true
    die "copy of /data failed — $old started again, nothing changed"
  fi
  say "copy of /data: backups/$backup"
fi

set_digest "$digest"
say "starting $digest"
compose up -d app > /dev/null

if wait_healthy; then
  say "OK: $digest is healthy"
  prune_backups || say "warning: old copies of /data were not pruned"
  exit 0
fi

say "$digest did not become healthy in ${HEALTH_TIMEOUT_S}s (logs: on the server, 'docker compose logs app')"
compose stop -t 30 app > /dev/null || true
[ -n "$old" ] || die "first deploy failed; nothing to roll back to — the container is stopped"

say "rolling back to $old with backups/$backup"
docker run --rm --user 0 --network none \
  -v "$VOLUME:/data" -v "$APP_DIR/backups:/backup:ro" \
  --entrypoint sh "$REPO@$old" -c 'find /data -mindepth 1 -delete && tar -C /data -xpf "$1"' sh "/backup/$backup" \
  || die "ROLLBACK: restoring /data failed — manual action needed"
set_digest "$old"
compose up -d app > /dev/null
if wait_healthy; then
  die "rolled back to $old (healthy); $digest was NOT deployed"
fi
die "ROLLBACK: $old is not healthy either — manual action needed"
