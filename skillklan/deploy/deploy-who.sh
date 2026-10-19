#!/usr/bin/env bash
#
# Чи питати дозволу кнопкою в Telegram перед викладкою.
#
# Правило власника (2026-10-19): пушить власник — після зелених перевірок одразу в прод; будь-хто інший —
# кнопка (deploy-gate.sh). Агенти пушать акаунтом власника, тож для GitHub вони і є власник.
#
# Вхід (env):
#   DEPLOY_TRUSTED_ACTORS — логіни GitHub через пробіл або кому (змінна репозиторію, змінює лише адмін)
#   ACTOR                 — github.actor: хто запушив або злив PR
#   TRIGGERING_ACTOR      — github.triggering_actor: хто запустив саме цей ран (повтор може запустити інший)
#   FORCE_ASK             — "true": спитати й довіреного (ручний запуск із галочкою)
# Вихід: `gate=skip` або `gate=ask` — у $GITHUB_OUTPUT, якщо він заданий, і пояснення в лог.
#
# 🔴 FAIL-CLOSED: порожній список, порожній чи дивний логін, будь-що невідоме → ask. Логін порівнюється
# цілком і дослівно: «Skill-Klan-2» чи «skill-klan» довіреним не є.
#
# Межа: хто має право запису, може у своєму пуші переписати й цей скрипт — кнопка береже від випадкової
# викладки, а не від зловмисника з правом запису.

set -euo pipefail

trusted=" $(printf '%s' "${DEPLOY_TRUSTED_ACTORS:-}" | tr ',\t\r\n' '    ') "

is_trusted() {
  local login="$1"
  case "$login" in
    '' | *[[:space:]]*) return 1 ;;
  esac
  case "$trusted" in
    *" ${login} "*) return 0 ;;
  esac
  return 1
}

actor="${ACTOR:-}"
triggering="${TRIGGERING_ACTOR:-}"

if [ "${FORCE_ASK:-}" = "true" ]; then
  gate=ask
  why="кнопку попросили вручну"
elif ! is_trusted "$actor"; then
  gate=ask
  why="пушив «${actor:-невідомо}» — не з довірених"
elif ! is_trusted "$triggering"; then
  gate=ask
  why="ран запустив «${triggering:-невідомо}» — не з довірених"
else
  gate=skip
  why="пушив і запустив «${actor}» — довірений, кнопка не потрібна"
fi

echo "Дозвіл на викладку: ${why} → gate=${gate}"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "gate=${gate}" >> "$GITHUB_OUTPUT"
fi
