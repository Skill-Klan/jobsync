#!/usr/bin/env bash
#
# Тест deploy-who.sh — із вимоги власника, а не з коду: «пушить власник — одразу в прод, хтось інший — кнопка».
# Кожен випадок — окремий процес із чистим env; рішення читається з $GITHUB_OUTPUT, як його читає воркфлоу.

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${here}/../deploy/deploy-who.sh"
fails=0
ran=0

# expect <очікуване gate> <опис> <ТРАСТ> <ACTOR> <TRIGGERING_ACTOR> [FORCE_ASK]
expect() {
  local want="$1" what="$2" out got
  out="$(mktemp)"
  env -i PATH="$PATH" GITHUB_OUTPUT="$out" \
    DEPLOY_TRUSTED_ACTORS="$3" ACTOR="$4" TRIGGERING_ACTOR="$5" FORCE_ASK="${6:-}" \
    bash "$script" >/dev/null 2>&1
  got="$(grep -c '^gate=' "$out") $(sed -n 's/^gate=//p' "$out")"
  rm -f "$out"
  ran=$((ran + 1))
  if [ "$got" = "1 ${want}" ]; then
    echo "ok   — ${what}"
  else
    echo "FAIL — ${what}: чекав рівно один рядок gate=${want}, маю «${got}»"
    fails=$((fails + 1))
  fi
}

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

# Якір «обхід дійшов»: інакше вихід посеред файлу виглядав би як зелений набір.
if [ "$ran" -ne 15 ]; then
  echo "FAIL — виконано ${ran} випадків замість 15"
  fails=$((fails + 1))
fi

if [ "$fails" -ne 0 ]; then
  echo "deploy-who: ${fails} провалено"
  exit 1
fi
echo "deploy-who: усі ${ran} випадків зелені"
