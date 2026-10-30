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
#   DEPLOY_DIGEST_SOURCE  — звідки digest, лише там, де деплой іде за digest (зараз SkillKlan Job): `build` —
#                           зібрано й перевірено в цьому ж рані; будь-що інше непорожнє — вписала людина вручну.
#                           Не задано — правила немає: скрипт — однакова копія в пʼяти репо, у решти digest немає.
# Вихід: `gate=skip`, `gate=ask` або `gate=refuse` — у $GITHUB_OUTPUT, якщо він заданий, і пояснення в лог.
# На `refuse` — код виходу 1: крок падає, і далі воркфлоу не йде — ні кнопки, ні викладки.
#
# Ручний запуск із digest — лише довіреним (2026-10-29): digest від людини може бути будь-яким образом у ghcr,
# не обовʼязково зібраним з main, а в повідомленні кнопки видно лише digest — на око не відрізнити. Не
# довіреному шлях у прод один — злитий у main PR, з якого образ збирає сам воркфлоу.
#
# 🔴 FAIL-CLOSED: порожній список, порожній чи дивний логін, будь-що невідоме → ask; джерело digest задане, але
# не рівно `build` → refuse. Логін порівнюється цілком і дослівно: «Skill-Klan-2» чи «skill-klan» довіреним не є.
#
# Межа: хто має право запису, може у своїй гілці переписати й цей скрипт. Від нього береже не скрипт, а
# середовище server2 (ключ деплою видно лише з main) разом із захистом main; скрипт лише вирішує, коли питати.

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

digest_source="${DEPLOY_DIGEST_SOURCE:-}"

if [ -n "$digest_source" ] && [ "$digest_source" != build ] && { ! is_trusted "$actor" || ! is_trusted "$triggering"; }; then
  gate=refuse
  why="ручний запуск із digest — лише довіреним, а запустив «${actor:-невідомо}» (ран — «${triggering:-невідомо}»); шлях у прод — PR у main"
elif [ "${FORCE_ASK:-}" = "true" ]; then
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
if [ "$gate" = refuse ]; then
  echo "::error::${why}"
  exit 1
fi
