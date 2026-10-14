#!/usr/bin/env bash
# skillklan: тримає Server2 відкритим на :443 лише для Cloudflare, а nginx — таким, що вірить
# CF-Connecting-IP лише від адрес Cloudflare. Ставиться як /usr/local/sbin/cloudflare-sync
# (root), запускається щодня з cron і раз при налаштуванні.
#
# Fail closed: завантажене, що не схоже на список Cloudflare (сторінка помилки, обрізаний файл,
# мало діапазонів), не змінює НІЧОГО — лишаються попередні правила. nginx -t не пройшов →
# попередній конфіг повертається, ufw не чіпається.
set -euo pipefail

V4_URL="${CF_V4_URL:-https://www.cloudflare.com/ips-v4}"
V6_URL="${CF_V6_URL:-https://www.cloudflare.com/ips-v6}"
REALIP_CONF="${CF_REALIP_CONF:-/etc/nginx/conf.d/cloudflare-realip.conf}"
STATE="${CF_STATE_FILE:-/var/lib/cloudflare-sync/ranges}"
MIN_V4="${CF_MIN_V4:-10}"
MIN_V6="${CF_MIN_V6:-5}"

say() { echo "cloudflare-sync: $*"; }
die() { say "FAIL: $*" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsS --max-time 20 "$V4_URL" -o "$tmp/v4.raw" || die "download of the IPv4 list failed — nothing changed"
curl -fsS --max-time 20 "$V6_URL" -o "$tmp/v6.raw" || die "download of the IPv6 list failed — nothing changed"
tr -d '\r' < "$tmp/v4.raw" | sed '/^[[:space:]]*$/d' > "$tmp/v4"
tr -d '\r' < "$tmp/v6.raw" | sed '/^[[:space:]]*$/d' > "$tmp/v6"

v4_re='^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$'
v6_re='^[0-9a-f]{1,4}(:[0-9a-f]{0,4}){1,7}/([0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$'
if grep -Evq "$v4_re" "$tmp/v4"; then die "IPv4 list does not look like Cloudflare's — nothing changed"; fi
if grep -Eviq "$v6_re" "$tmp/v6"; then die "IPv6 list does not look like Cloudflare's — nothing changed"; fi
[ "$(wc -l < "$tmp/v4")" -ge "$MIN_V4" ] || die "IPv4 list is too short — nothing changed"
[ "$(wc -l < "$tmp/v6")" -ge "$MIN_V6" ] || die "IPv6 list is too short — nothing changed"
cat "$tmp/v4" "$tmp/v6" | tr 'A-F' 'a-f' | sort -u > "$tmp/ranges"

# --- nginx: кому вірити в CF-Connecting-IP ----------------------------------------
{
  echo "# managed by cloudflare-sync — do not edit by hand"
  while read -r r; do echo "set_real_ip_from $r;"; done < "$tmp/ranges"
  echo "real_ip_header CF-Connecting-IP;"
} > "$tmp/realip.conf"

if ! cmp -s "$tmp/realip.conf" "$REALIP_CONF"; then
  had_old=0
  if [ -f "$REALIP_CONF" ]; then cp -p "$REALIP_CONF" "$tmp/realip.old"; had_old=1; fi
  install -m 644 "$tmp/realip.conf" "$REALIP_CONF"
  if ! nginx -t -q; then
    if [ "$had_old" = 1 ]; then cp -p "$tmp/realip.old" "$REALIP_CONF"; else rm -f "$REALIP_CONF"; fi
    die "nginx -t failed with the new list — previous config restored, firewall untouched"
  fi
  systemctl reload nginx
  say "nginx: real IP list updated"
fi

# --- ufw: :443 лише з цих діапазонів ------------------------------------------------
mkdir -p "$(dirname "$STATE")"
touch "$STATE"
sort -u "$STATE" > "$tmp/applied"
comm -13 "$tmp/applied" "$tmp/ranges" > "$tmp/add"
comm -23 "$tmp/applied" "$tmp/ranges" > "$tmp/remove"

while read -r r; do
  ufw allow proto tcp from "$r" to any port 443 comment 'cloudflare-443' > /dev/null
done < "$tmp/add"
while read -r r; do
  ufw delete allow proto tcp from "$r" to any port 443 > /dev/null || true
done < "$tmp/remove"
cp "$tmp/ranges" "$STATE"
say "ufw: +$(wc -l < "$tmp/add") −$(wc -l < "$tmp/remove") (443 from $(wc -l < "$tmp/ranges") Cloudflare ranges)"
