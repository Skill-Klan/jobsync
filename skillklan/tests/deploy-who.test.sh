#!/usr/bin/env bash
#
# Тест deploy-who.sh — із вимоги власника, а не з коду: «пушить власник — одразу в прод, хтось інший — кнопка»;
# ручний запуск із digest, вписаним людиною, — лише довіреним, іншим — відмова (2026-10-29).
# Кожен випадок — окремий процес із чистим env; рішення читається з $GITHUB_OUTPUT, як його читає воркфлоу, а
# відмова — ще й кодом виходу: воркфлоу зупиняє саме провалений крок.

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${here}/../deploy/deploy-who.sh"
fails=0
ran=0
# Звідки digest (DEPLOY_DIGEST_SOURCE) — задається перед кожною групою: порожньо — змінної немає (решта репо, де
# деплой не за digest), `build` — зібраний і перевірений у цьому ж рані, інше — вписаний людиною вручну.
digest_source=""

# expect <очікуване gate> <опис> <ТРАСТ> <ACTOR> <TRIGGERING_ACTOR> [FORCE_ASK]
expect() {
  local want="$1" what="$2" out got rc rc_ok=no
  out="$(mktemp)"
  env -i PATH="$PATH" GITHUB_OUTPUT="$out" \
    DEPLOY_TRUSTED_ACTORS="$3" ACTOR="$4" TRIGGERING_ACTOR="$5" FORCE_ASK="${6:-}" \
    ${digest_source:+DEPLOY_DIGEST_SOURCE="$digest_source"} \
    bash "$script" >/dev/null 2>&1
  rc=$?
  got="$(grep -c '^gate=' "$out") $(sed -n 's/^gate=//p' "$out")"
  rm -f "$out"
  ran=$((ran + 1))
  # Відмова мусить провалити крок (інакше наступний крок попросив би кнопку); skip і ask — ні.
  if [ "$want" = refuse ]; then
    [ "$rc" -ne 0 ] && rc_ok=yes
  else
    [ "$rc" -eq 0 ] && rc_ok=yes
  fi
  if [ "$got" = "1 ${want}" ] && [ "$rc_ok" = yes ]; then
    echo "ok   — ${what}"
  else
    echo "FAIL — ${what}: чекав рівно один рядок gate=${want} і відповідний код виходу, маю «${got}», код ${rc}"
    fails=$((fails + 1))
  fi
}

# --- Змінної джерела немає: решта чотири репо (там деплой не за digest) — правило без змін ---
digest_source=""

# Власник — без кнопки.
expect skip "власник запушив і сам запустив ран" "Skill-Klan" "Skill-Klan" "Skill-Klan"
expect skip "список через кому, власник другий" "Other,Skill-Klan" "Skill-Klan" "Skill-Klan"

# Будь-хто інший — кнопка.
expect ask "пушила колега з правом запису" "Skill-Klan" "InessaPopovich" "InessaPopovich"
expect ask "власник запушив, а повтор рану запустив інший" "Skill-Klan" "Skill-Klan" "InessaPopovich"
expect ask "інший запушив, а власник лише перезапустив" "Skill-Klan" "InessaPopovich" "Skill-Klan"
expect ask "Dependabot" "Skill-Klan" "dependabot[bot]" "dependabot[bot]"
expect ask "[bot] у логіні не працює як шаблон" "dependabotb" "dependabot[bot]" "dependabot[bot]"

# Схожі логіни — не власник.
expect ask "довший логін, що починається з власника" "Skill-Klan" "Skill-Klan-2" "Skill-Klan-2"
expect ask "той самий логін іншим регістром" "Skill-Klan" "skill-klan" "skill-klan"
expect ask "частина логіна" "Skill-Klan" "Klan" "Klan"
expect ask "у списку довший логін, пушив коротший" "Skill-Klan-2" "Skill-Klan" "Skill-Klan"
expect ask "логін із пробілом не склеюється з двох довірених" "Skill-Klan Other" "Skill-Klan Other" "Skill-Klan Other"

# Fail-closed.
expect ask "змінна зі списком не задана" "" "Skill-Klan" "Skill-Klan"
expect ask "автор невідомий" "Skill-Klan" "" ""
expect ask "власник сам попросив кнопку" "Skill-Klan" "Skill-Klan" "Skill-Klan" "true"

# --- SkillKlan Job, push у main: digest зібрано й перевірено в цьому ж рані — як без змінної ---
digest_source="build"

expect skip "Job: власник запушив" "Skill-Klan" "Skill-Klan" "Skill-Klan"
expect ask "Job: колега злив PR у main — кнопка, не відмова" "Skill-Klan" "InessaPopovich" "InessaPopovich"
expect ask "Job: власник запушив, колега перезапустив" "Skill-Klan" "Skill-Klan" "InessaPopovich"
expect ask "Job: автор невідомий" "Skill-Klan" "" ""

# --- SkillKlan Job, ручний запуск: digest вписала людина ---
# Такий digest може бути будь-яким образом у ghcr, не обовʼязково зібраним з main, а в повідомленні кнопки видно
# лише digest. Тому не довіреному — відмова, а не кнопка: його шлях у прод — злитий у main PR.
digest_source="manual"

expect skip "власник вручну — відкат на попередній digest" "Skill-Klan" "Skill-Klan" "Skill-Klan"
expect ask "власник вручну й попросив кнопку" "Skill-Klan" "Skill-Klan" "Skill-Klan" "true"
expect refuse "колега вручну" "Skill-Klan" "InessaPopovich" "InessaPopovich"
expect refuse "колега вручну й попросив кнопку — однаково ні" "Skill-Klan" "InessaPopovich" "InessaPopovich" "true"
expect refuse "власник запустив вручну, колега перезапустив" "Skill-Klan" "Skill-Klan" "InessaPopovich"
expect refuse "колега запустив вручну, власник лише перезапустив" "Skill-Klan" "InessaPopovich" "Skill-Klan"
expect refuse "список довірених не задано — ручний запуск не пройде ні в кого" "" "Skill-Klan" "Skill-Klan"

# Fail-closed: джерело задане, але не рівно `build` — ручний.
digest_source="Build"
expect refuse "«Build» з великої — не build" "Skill-Klan" "InessaPopovich" "InessaPopovich"
digest_source="true"
expect refuse "«true» — не build" "Skill-Klan" "InessaPopovich" "InessaPopovich"

# Якір «обхід дійшов»: інакше вихід посеред файлу виглядав би як зелений набір.
if [ "$ran" -ne 28 ]; then
  echo "FAIL — виконано ${ran} випадків замість 28"
  fails=$((fails + 1))
fi

if [ "$fails" -ne 0 ]; then
  echo "deploy-who: ${fails} провалено"
  exit 1
fi
echo "deploy-who: усі ${ran} випадків зелені"
