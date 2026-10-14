#!/usr/bin/env bash
# skillklan: тест cloudflare-sync (skillklan/server/cloudflare-sync.sh) — перевіряє ВИМОГИ:
#
#   C1  перший запуск: nginx вірить CF-Connecting-IP рівно від кожного діапазону, ufw пускає :443
#       з кожного, nginx перезавантажено
#   C2  Cloudflare змінив список: зайвий діапазон прибрано з ufw, новий додано, решту не чіпали
#   C3  той самий список: ні reload, ні ufw
#   C4  сторінка помилки замість списку → нічого не змінено (ні конфіг, ні ufw)
#   C5  обрізаний список (мало діапазонів) → нічого не змінено
#   C6  завантаження обірвалось (частина списку вже записана) → нічого не змінено
#   C7  nginx -t не пройшов → попередній конфіг на місці, ufw не чіпали
#
# Запуск: bash skillklan/tests/cloudflare-sync.test.sh
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${SCRIPT:-$ROOT/skillklan/server/cloudflare-sync.sh}"
FAILS=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

V4_LIST="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
V6_LIST="2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32"

setup() {
  T="$(mktemp -d)"; BIN="$T/bin"; mkdir -p "$BIN" "$T/www"
  printf '%s\n' $V4_LIST > "$T/www/ips-v4"; printf '%s\n' $V6_LIST > "$T/www/ips-v6"
  : > "$T/calls"
  cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
url=""; out=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; --max-time) shift 2;; -*) shift;; *) url="$1"; shift;; esac; done
# Збій як на таймауті: частина списку вже записана (і сама по собі виглядає правильною), код 28.
if [ "${CURL_FAILS:-}" = "$(basename "$url")" ]; then head -n 12 "$FAKE_WWW/$(basename "$url")" > "$out"; exit 28; fi
cp "$FAKE_WWW/$(basename "$url")" "$out"
EOF
  cat > "$BIN/ufw" <<'EOF'
#!/usr/bin/env bash
echo "ufw $*" >> "$FAKE_CALLS"
EOF
  cat > "$BIN/nginx" <<'EOF'
#!/usr/bin/env bash
echo "nginx $*" >> "$FAKE_CALLS"
[ "${NGINX_T_FAILS:-0}" = 1 ] && exit 1
exit 0
EOF
  cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "systemctl $*" >> "$FAKE_CALLS"
EOF
  chmod +x "$BIN"/*
  export PATH="$BIN:$PATH" FAKE_WWW="$T/www" FAKE_CALLS="$T/calls"
  export CF_V4_URL="https://www.cloudflare.com/ips-v4" CF_V6_URL="https://www.cloudflare.com/ips-v6"
  export CF_REALIP_CONF="$T/cloudflare-realip.conf" CF_STATE_FILE="$T/state/ranges"
  export CURL_FAILS="" NGINX_T_FAILS=0
}
teardown() { rm -rf "$T"; }
run() { bash "$SCRIPT" > "$T/out" 2>&1; echo $?; }
allowed() { grep -c "^ufw allow proto tcp from .* to any port 443" "$T/calls"; }
deleted() { grep -c "^ufw delete allow proto tcp from .* to any port 443" "$T/calls"; }
total=$(( $(printf '%s\n' $V4_LIST | wc -l) + $(printf '%s\n' $V6_LIST | wc -l) ))

# --- C1 ---
setup
rc=$(run)
realip_ok=1
for r in $V4_LIST $V6_LIST; do grep -qx "set_real_ip_from $r;" "$CF_REALIP_CONF" || realip_ok=0; done
[ "$(grep -c '^set_real_ip_from ' "$CF_REALIP_CONF" 2>/dev/null)" = "$total" ] || realip_ok=0
grep -qx "real_ip_header CF-Connecting-IP;" "$CF_REALIP_CONF" || realip_ok=0
if [ "$rc" = 0 ] && [ "$realip_ok" = 1 ] && [ "$(allowed)" = "$total" ] && grep -q "^systemctl reload nginx" "$T/calls"; then
  pass "C1 first run: nginx trusts exactly Cloudflare, ufw opens 443 to each range"
else fail "C1 first run (rc=$rc realip=$realip_ok allowed=$(allowed)/$total)"; sed 's/^/     | /' "$T/out"; fi

# --- C2 (same temp dir: state from C1) ---
: > "$T/calls"
printf '%s\n' $V4_LIST | grep -v '^131.0.72.0/22$' > "$T/www/ips-v4"; echo "198.51.100.0/24" >> "$T/www/ips-v4"
rc=$(run)
if [ "$rc" = 0 ] && [ "$(allowed)" = 1 ] && grep -q "from 198.51.100.0/24 to any port 443" "$T/calls" \
   && [ "$(deleted)" = 1 ] && grep -q "delete allow proto tcp from 131.0.72.0/22 " "$T/calls" \
   && ! grep -q "set_real_ip_from 131.0.72.0/22;" "$CF_REALIP_CONF"; then
  pass "C2 changed list: stale range removed, new one added, the rest untouched"
else fail "C2 changed list (rc=$rc allowed=$(allowed) deleted=$(deleted))"; sed 's/^/     | /' "$T/out"; fi

# --- C3 ---
: > "$T/calls"
rc=$(run)
if [ "$rc" = 0 ] && ! grep -q "^systemctl" "$T/calls" && ! grep -q "^ufw" "$T/calls"; then pass "C3 same list: nothing touched"
else fail "C3 same list (rc=$rc)"; sed 's/^/     | /' "$T/calls"; fi
teardown

# --- C4 ---
setup
run > /dev/null; cp "$CF_REALIP_CONF" "$T/before"; : > "$T/calls"
# Справжня сторінка помилки — багато рядків, тож перевірка довжини її НЕ ловить: лише формат.
{ echo '<!DOCTYPE html>'; for i in $(seq 1 20); do echo "<p>Error 1020 line $i</p>"; done; } > "$T/www/ips-v4"
rc=$(run)
if [ "$rc" != 0 ] && cmp -s "$CF_REALIP_CONF" "$T/before" && ! grep -q "^ufw\|^systemctl" "$T/calls"; then pass "C4 an error page instead of the list changes nothing"
else fail "C4 error page (rc=$rc)"; fi
teardown

# --- C5 ---
setup
run > /dev/null; cp "$CF_REALIP_CONF" "$T/before"; : > "$T/calls"
printf '%s\n' 173.245.48.0/20 103.21.244.0/22 > "$T/www/ips-v4"
rc=$(run)
if [ "$rc" != 0 ] && cmp -s "$CF_REALIP_CONF" "$T/before" && ! grep -q "^ufw\|^systemctl" "$T/calls"; then pass "C5 a truncated list changes nothing"
else fail "C5 truncated (rc=$rc)"; sed 's/^/     | /' "$T/calls"; fi
teardown

# --- C6: кожне завантаження окремо — інакше друге прикриває першe ---
for list in ips-v4 ips-v6; do
  setup
  run > /dev/null; cp "$CF_REALIP_CONF" "$T/before"; : > "$T/calls"
  echo "198.51.100.0/24" >> "$T/www/ips-v4"
  CURL_FAILS="$list" rc=$(run)
  if [ "$rc" != 0 ] && cmp -s "$CF_REALIP_CONF" "$T/before" && ! grep -q "^ufw\|^systemctl" "$T/calls"; then pass "C6 interrupted download of $list changes nothing"
  else fail "C6 interrupted download of $list (rc=$rc)"; fi
  teardown
done

# --- C7 ---
setup
run > /dev/null; cp "$CF_REALIP_CONF" "$T/before"; : > "$T/calls"
echo "198.51.100.0/24" >> "$T/www/ips-v4"
NGINX_T_FAILS=1 rc=$(run)
if [ "$rc" != 0 ] && cmp -s "$CF_REALIP_CONF" "$T/before" && ! grep -q "^ufw\|^systemctl reload" "$T/calls"; then pass "C7 nginx -t failure restores the old config, firewall untouched"
else fail "C7 nginx -t (rc=$rc)"; sed 's/^/     | /' "$T/calls"; fi
teardown

echo "---- $FAILS failed"
[ "$FAILS" -eq 0 ]
