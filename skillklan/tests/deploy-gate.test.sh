#!/usr/bin/env bash
#
# Тест deploy-gate.sh проти локальної заглушки бота (127.0.0.1, без мережі назовні).
# Вимоги: секрет береться з env-файла бота, коли змінна порожня; дозволено → 0; відмова, чужий секрет чи
# немає секрету → не 0 і без запиту до бота; значення секрету в лог не потрапляє.

# shellcheck disable=SC2034  # $code читають умови check (через eval)
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${here}/../deploy/deploy-gate.sh"
work="$(mktemp -d)"
fails=0
ran=0
stub_pid=""

cleanup() {
  [ -n "$stub_pid" ] && kill "$stub_pid" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT

SECRET="s3cr3t-$RANDOM-$RANDOM"

# Заглушка: POST /gate з правильним секретом → 202, інакше 401; GET /gate/<id> → {"status": $STUB_DECISION}.
# Кожен запит пише рядок у requests.log — так видно, чи скрипт узагалі ходив до бота.
start_stub() {
  rm -f "$work/port" "$work/requests.log"
  STUB_SECRET="$SECRET" STUB_DECISION="$1" STUB_DIR="$work" python3 - <<'PY' &
import http.server, json, os, re
secret, decision, d = os.environ["STUB_SECRET"], os.environ["STUB_DECISION"], os.environ["STUB_DIR"]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def answer(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def note(self):
        ok = self.headers.get("X-Deploy-Gate-Secret") == secret
        with open(os.path.join(d, "requests.log"), "a") as f:
            f.write(f"{self.command} {self.path} secret={'ok' if ok else 'wrong'}\n")
        return ok
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if not self.note(): return self.answer(401, {"ok": False})
        # Як бот (isValidGateId): лише [A-Za-z0-9-]{1,40}, інакше 400.
        if not re.fullmatch(r"[A-Za-z0-9-]{1,40}", str(body.get("gateId", ""))): return self.answer(400, {"ok": False})
        self.answer(202, {"ok": True})
    def do_GET(self):
        if not self.note(): return self.answer(401, {"ok": False})
        self.answer(200, {"status": decision})
s = http.server.HTTPServer(("127.0.0.1", 0), H)
open(os.path.join(d, "port"), "w").write(str(s.server_port))
s.serve_forever()
PY
  stub_pid=$!
  for _ in $(seq 50); do [ -s "$work/port" ] && break; sleep 0.1; done
}

stop_stub() {
  kill "$stub_pid" 2>/dev/null
  wait "$stub_pid" 2>/dev/null
  stub_pid=""
}

# run_gate <файл секрету або ""> [GATE_ID] — запускає гейт без DEPLOY_GATE_SECRET у env; лог — у $work/out
run_gate() {
  env -i PATH="$PATH" HOME="$work" \
    DEPLOY_GATE_SECRET_FILE="$1" \
    DEPLOY_GATE_URL="http://127.0.0.1:$(cat "$work/port" 2>/dev/null || echo 9)/gate" \
    GATE_ID="${2:-test-1}" GATE_REPO="r" GATE_SHA="abc" GATE_ACTOR="someone" GATE_MESSAGE="m" \
    GATE_TTL_SEC=5 GATE_POLL_SEC=0 \
    bash "$script" > "$work/out" 2>&1
}

check() {
  ran=$((ran + 1))
  if eval "$2"; then
    echo "ok   — $1"
  else
    echo "FAIL — $1"
    sed 's/^/       │ /' "$work/out" 2>/dev/null | head -5
    fails=$((fails + 1))
  fi
}

no_secret_in_log() { ! grep -qF "$SECRET" "$work/out"; }

# Env-файл бота, як на сервері: лапки й CRLF, ключ не перший, останнє входження перемагає.
printf 'OTHER=1\nDEPLOY_GATE_SECRET=old\nDEPLOY_GATE_SECRET="%s"\r\n' "$SECRET" > "$work/bot.env"

start_stub approved
run_gate "$work/bot.env"; code=$?
check "секрет із env-файла бота → бот прийняв, «дозволено» → 0" '[ "$code" -eq 0 ] && grep -q "^POST /gate secret=ok" "$work/requests.log"'
check "секрет не потрапив у лог" 'no_secret_in_log'
stop_stub

start_stub rejected
run_gate "$work/bot.env"; code=$?
check "відмова в Telegram → не 0" '[ "$code" -ne 0 ] && grep -q "зупинено" "$work/out"'
check "секрет не потрапив у лог і при відмові" 'no_secret_in_log'
stop_stub

printf 'DEPLOY_GATE_SECRET=not-the-bots\n' > "$work/wrong.env"
start_stub approved
run_gate "$work/wrong.env"; code=$?
check "чужий секрет → бот 401 → не 0, без опитування" '[ "$code" -ne 0 ] && grep -q "не прийняв секрет" "$work/out" && ! grep -q "^GET" "$work/requests.log"'
stop_stub

start_stub approved
run_gate "$work/bot.env" "web_app-123-1"; code=$?
check "GATE_ID з підкресленням → не 0, причина названа, до бота не ходили" '[ "$code" -ne 0 ] && grep -q "не підходить" "$work/out" && [ ! -s "$work/requests.log" ]'
stop_stub

printf 'OTHER=1\n' > "$work/empty.env"
start_stub approved
run_gate "$work/empty.env"; code=$?
check "у файлі немає ключа → не 0 і до бота не ходили" '[ "$code" -ne 0 ] && grep -q "не заданий" "$work/out" && [ ! -s "$work/requests.log" ]'
run_gate ""; code=$?
check "ні змінної, ні файла → не 0 і до бота не ходили" '[ "$code" -ne 0 ] && grep -q "не заданий" "$work/out" && [ ! -s "$work/requests.log" ]'
run_gate "$work/missing.env"; code=$?
check "файла немає → не 0" '[ "$code" -ne 0 ] && grep -q "не заданий" "$work/out"'
stop_stub

# Якір «обхід дійшов».
if [ "$ran" -ne 9 ]; then
  echo "FAIL — виконано ${ran} перевірок замість 9"
  fails=$((fails + 1))
fi

if [ "$fails" -ne 0 ]; then
  echo "deploy-gate: ${fails} провалено"
  exit 1
fi
echo "deploy-gate: усі ${ran} перевірок зелені"
