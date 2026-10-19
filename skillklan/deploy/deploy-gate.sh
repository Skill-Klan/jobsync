#!/usr/bin/env bash
#
# Гейт викладки: питає дозволу в Telegram і чекає натискання.
#
# Однакові копії — у сайті, SkillKlan Job, бекенді, кабінеті й боті: той самий бот, та сама кнопка, той
# самий контракт. Міняти всі копії разом. Чи питати взагалі, вирішує deploy-who.sh (власник — без кнопки).
#
# Навіщо не рідні механізми GitHub: Environments з обовʼязковими рецензентами
# й required status checks платні для приватного репозиторію. Цей гейт живе
# всередині воркфлоу й працює на будь-якому тарифі.
#
# 🔴 FAIL-CLOSED. Будь-що, крім явного «дозволено», зупиняє викладку:
# немає секрету, недосяжний бот, відмова, таймаут, протухлий гейт. Мовчання
# згодою не є — інакше гейт був би прикрасою.
#
# Потрібні змінні:
#   DEPLOY_GATE_SECRET  — спільний секрет із ботом (секрет репозиторію)
#     або DEPLOY_GATE_SECRET_FILE — env-файл бота, звідки його взяти: раннери бекенду, кабінету й бота
#     живуть на тому самому сервері, що й бот, тож секрет не дублюється в GitHub
#   GATE_ID             — унікальний id запуску
#   GATE_REPO, GATE_SHA, GATE_ACTOR, GATE_MESSAGE — що показати людині
# Необовʼязкові:
#   DEPLOY_GATE_URL     — базова адреса маршруту
#   GATE_TTL_SEC        — скільки чекати (за замовчуванням 1800)
#   GATE_POLL_SEC       — період опитування (за замовчуванням 10)

set -euo pipefail

BASE_URL="${DEPLOY_GATE_URL:-https://api.skillklan.com.ua/api/webapp/deploy-gate}"
TTL_SEC="${GATE_TTL_SEC:-1800}"
POLL_SEC="${GATE_POLL_SEC:-10}"

fail() {
  echo "::error::$1"
  exit 1
}

# Читає значення змінної з env-файла, не виконуючи його (файл із секретами не source-имо). Останнє
# входження, як у docker; лапки й CRLF зрізаються. Значення нікуди не друкується.
read_env_var() {
  local file="$1" key="$2" line value
  [ -r "$file" ] || return 1
  line=$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1) || return 1
  [ -n "$line" ] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}" ; value="${value%\"}"
  value="${value#\'}" ; value="${value%\'}"
  [ -n "$value" ] || return 1
  printf '%s' "$value"
}

if [ -z "${DEPLOY_GATE_SECRET:-}" ] && [ -n "${DEPLOY_GATE_SECRET_FILE:-}" ]; then
  DEPLOY_GATE_SECRET="$(read_env_var "$DEPLOY_GATE_SECRET_FILE" DEPLOY_GATE_SECRET)" || DEPLOY_GATE_SECRET=""
fi

[ -n "${DEPLOY_GATE_SECRET:-}" ] || fail \
  "DEPLOY_GATE_SECRET не заданий (ні секретом репозиторію, ні у ${DEPLOY_GATE_SECRET_FILE:-env-файлі бота}) — той самий, що в env бота. Без нього викладка не дозволяється."
[ -n "${GATE_ID:-}" ] || fail "GATE_ID не заданий"

# ⚠️ Тіло збирається через jq, а не через рядкову підстановку: заголовок
# коміту може містити лапки, зворотні слеші й переноси рядків. Рукописний
# JSON тут ламався б рівно на тому коміті, який найбільше треба показати.
payload=$(jq -n \
  --arg gateId "$GATE_ID" \
  --arg repo "${GATE_REPO:-—}" \
  --arg sha "${GATE_SHA:-—}" \
  --arg actor "${GATE_ACTOR:-—}" \
  --arg message "${GATE_MESSAGE:-—}" \
  --argjson ttlSec "$TTL_SEC" \
  '{gateId:$gateId, repo:$repo, sha:$sha, actor:$actor, message:$message, ttlSec:$ttlSec}')

echo "Питаю дозволу на викладку (gate ${GATE_ID})…"

open_body=$(curl -sS --max-time 20 -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Gate-Secret: ${DEPLOY_GATE_SECRET}" \
  -w '\n%{http_code}' \
  --data "$payload") || fail "бот недосяжний — викладку не дозволено"

open_code=$(printf '%s' "$open_body" | tail -n1)
case "$open_code" in
  202) : ;;
  401) fail "бот не прийняв секрет. Значення в репозиторії й у env бота мають збігатися" ;;
  503) fail "у бота не заданий DEPLOY_GATE_SECRET — гейт закритий" ;;
  *)   fail "бот відповів ${open_code} — викладку не дозволено" ;;
esac

echo "Запит у гілці. Чекаю рішення до ${TTL_SEC} с…"

deadline=$(( SECONDS + TTL_SEC ))
while [ "$SECONDS" -lt "$deadline" ]; do
  sleep "$POLL_SEC"

  body=$(curl -sS --max-time 15 "${BASE_URL}/${GATE_ID}" \
    -H "X-Deploy-Gate-Secret: ${DEPLOY_GATE_SECRET}" \
    -w '\n%{http_code}') || {
      echo "опитування не вдалось, повторю"
      continue
    }

  code=$(printf '%s' "$body" | tail -n1)
  json=$(printf '%s' "$body" | sed '$d')

  # 404 — гейта немає або протух. Для нас це «не дозволено», а не «ще раз»:
  # найімовірніша причина — рестарт бота, і мовчки чекати далі означало б
  # висіти до таймауту без жодного шансу.
  [ "$code" = "404" ] && fail "гейт закрився (найімовірніше рестарт бота). Запустіть деплой заново"
  [ "$code" = "200" ] || { echo "бот відповів ${code}, повторю"; continue; }

  status=$(printf '%s' "$json" | jq -r '.status // "pending"')
  case "$status" in
    approved)
      echo "Дозволено. Викладаю."
      exit 0
      ;;
    rejected)
      fail "Викладку зупинено рішенням у Telegram"
      ;;
    *) : ;;
  esac
done

fail "рішення не надійшло за ${TTL_SEC} с — викладку не дозволено"
