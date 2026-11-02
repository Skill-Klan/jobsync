#!/usr/bin/env bash
#
# Тест deploy-is-head.sh — із вимоги власника (D88, 2026-11-02): «викладати лише найновіший коміт main». Старіший ран
# (перезапуск скасованого, черга злиттів) не викладає нічого й не падає; не вдалось дізнатися голову main — не
# викладаємо (крок падає). Голова main — справжнє голе git-репо, рішення читається з $GITHUB_OUTPUT, як його читає
# воркфлоу. Друга частина (W1–W4) — що воркфлоу деплою справді питає скрипт до кнопки й після неї.

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${here}/../deploy/deploy-is-head.sh"
workflow="${here}/../../.github/workflows/skillklan-deploy.yml"
fails=0
ran=0

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

g() { git -c user.name=t -c user.email=t@example.com -c init.defaultBranch=main -c commit.gpgsign=false "$@"; }

# Голе «origin» з main: old → mid → head; гілка-приманка `decoy/refs/heads/main` на окремому коміті.
g init -q "$tmp/work"
g -C "$tmp/work" commit -q --allow-empty -m old
old="$(git -C "$tmp/work" rev-parse HEAD)"
g -C "$tmp/work" commit -q --allow-empty -m mid
mid="$(git -C "$tmp/work" rev-parse HEAD)"
g -C "$tmp/work" commit -q --allow-empty -m head
head="$(git -C "$tmp/work" rev-parse HEAD)"
g -C "$tmp/work" checkout -q -b side "$old"
g -C "$tmp/work" commit -q --allow-empty -m decoy
decoy="$(git -C "$tmp/work" rev-parse HEAD)"
g init -q --bare "$tmp/origin.git"
g -C "$tmp/work" push -q "$tmp/origin.git" "${head}:refs/heads/main" "${decoy}:refs/heads/decoy/refs/heads/main"
# Репо без main — лише приманка.
g init -q --bare "$tmp/no-main.git"
g -C "$tmp/work" push -q "$tmp/no-main.git" "${decoy}:refs/heads/decoy/refs/heads/main"

# expect <yes|no|fail> <опис> <DEPLOY_SHA> [DEPLOY_REMOTE] [no-output]
expect() {
  local want="$1" what="$2" sha="$3" remote="${4:-$tmp/origin.git}" out summary got rc ok=no
  out="$(mktemp)"
  summary="$(mktemp)"
  if [ "${5:-}" = no-output ]; then
    env -i PATH="$PATH" HOME="$tmp" DEPLOY_SHA="$sha" DEPLOY_REMOTE="$remote" bash "$script" > /dev/null 2>&1
  else
    env -i PATH="$PATH" HOME="$tmp" GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY="$summary" \
      DEPLOY_SHA="$sha" DEPLOY_REMOTE="$remote" bash "$script" > /dev/null 2>&1
  fi
  rc=$?
  got="$(grep -c '^deploy=' "$out") $(sed -n 's/^deploy=//p' "$out")"
  ran=$((ran + 1))
  case "$want" in
    # Рішення — рівно один рядок; «no» — не помилка: старший ран зелений, його просто нема чого викладати.
    yes) [ "$rc" -eq 0 ] && [ "$got" = "1 yes" ] && ok=yes ;;
    no) [ "$rc" -eq 0 ] && [ "$got" = "1 no" ] && grep -q "${head:0:7}" "$summary" && ok=yes ;;
    # Fail-closed: крок падає і жодного рішення не пише — наступні кроки не мають на що спертися.
    fail) [ "$rc" -ne 0 ] && [ "$got" = "0 " ] && ok=yes ;;
  esac
  if [ "$ok" = yes ]; then
    echo "ok   — ${what}"
  else
    echo "FAIL — ${what}: чекав ${want}, маю рішення «${got}», код ${rc}, підсумок «$(cat "$summary")»"
    fails=$((fails + 1))
  fi
  rm -f "$out" "$summary"
}

expect yes "H1 коміт рану — голова main" "$head"
expect no "H2 main пішов далі на один коміт (черга злиттів)" "$mid"
expect no "H3 main пішов далі на два коміти (перезапуск старого скасованого рану)" "$old"
expect no "H4 коміт не з main — гілка-приманка з refs/heads/main у назві" "$decoy"
expect fail "H5 origin недосяжний" "$head" "$tmp/nowhere.git"
expect fail "H6 в origin немає main, є лише приманка" "$decoy" "$tmp/no-main.git"
expect fail "H7 короткий SHA голови — префікс не рахується" "${head:0:7}"
expect fail "H8 SHA голови великими літерами — не той формат" "$(printf '%s' "$head" | tr 'a-f' 'A-F')"
expect fail "H9 SHA не задано" ""
expect fail "H10 GITHUB_OUTPUT не заданий" "$head" "" no-output

# --- W: воркфлоу питає скрипт до кнопки й після неї, а викладка чекає обидві відповіді ---

# Блок кроку за назвою: від «- name: <назва>» до наступного кроку того самого відступу.
step() {
  awk -v name="      - name: $1" '
    index($0, name) == 1 && length($0) == length(name) { on = 1; print; next }
    on && /^      - / { exit }
    on { print }' "$workflow"
}
line_of() { grep -n -F -x "      - name: $1" "$workflow" | cut -d: -f1; }

wexpect() {
  ran=$((ran + 1))
  if [ "$1" = ok ]; then echo "ok   — $2"; else echo "FAIL — $2"; fails=$((fails + 1)); fi
}

before="Only the head of main is deployed"
after="Still the head of main after the approval"
gate="Ask the owner in Telegram (not the owner's push)"
deploy="Deploy on Server2"

b_before="$(step "$before")"
b_after="$(step "$after")"
if grep -q -x '        id: head' <<< "$b_before" && grep -q -x '        if: inputs.digest_from_build' <<< "$b_before" &&
  grep -q -F 'DEPLOY_SHA: ${{ github.sha }}' <<< "$b_before" && grep -q -F 'bash skillklan/deploy/deploy-is-head.sh' <<< "$b_before" &&
  grep -q -x '        id: head_after' <<< "$b_after" && grep -q -F 'DEPLOY_SHA: ${{ github.sha }}' <<< "$b_after" &&
  grep -q -F 'bash skillklan/deploy/deploy-is-head.sh' <<< "$b_after"; then
  wexpect ok "W1 обидві перевірки кличуть скрипт з github.sha; перша — лише для digest зі збірки (ручний відкат — без неї)"
else
  wexpect fail "W1 крок «${before}» або «${after}» не той"
fi

l_before="$(line_of "$before")" l_gate="$(line_of "$gate")" l_after="$(line_of "$after")" l_deploy="$(line_of "$deploy")"
if [ -n "$l_before" ] && [ -n "$l_gate" ] && [ -n "$l_after" ] && [ -n "$l_deploy" ] &&
  [ "$l_before" -lt "$l_gate" ] && [ "$l_gate" -lt "$l_after" ] && [ "$l_after" -lt "$l_deploy" ]; then
  wexpect ok "W2 порядок: перевірка → кнопка → перевірка → викладка"
else
  wexpect fail "W2 порядок кроків: перевірка ${l_before:-—}, кнопка ${l_gate:-—}, повторна ${l_after:-—}, викладка ${l_deploy:-—}"
fi

if step "$gate" | grep -q -E "^        if: .*steps\.head\.outputs\.deploy != 'no'"; then
  wexpect ok "W3 старший ран кнопку не питає"
else
  wexpect fail "W3 кнопка не залежить від перевірки голови"
fi

d_if="$(step "$deploy" | grep -E '^        if: ' || true)"
if grep -q -F "steps.head.outputs.deploy != 'no'" <<< "$d_if" && grep -q -F "steps.head_after.outputs.deploy != 'no'" <<< "$d_if"; then
  wexpect ok "W4 викладка чекає обидві відповіді"
else
  wexpect fail "W4 умова викладки «${d_if}» не чекає обох перевірок"
fi

echo "${ran} випадків, провалено ${fails}"
[ "$fails" -eq 0 ]
