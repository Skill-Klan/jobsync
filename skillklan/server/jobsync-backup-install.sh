#!/usr/bin/env bash
# skillklan: switch on the Mac's copy of /data on Server2 (D11). The owner runs it as root:
#
#   sudo bash jobsync-backup-install.sh <folder>
#
# <folder> holds jobsync-deploy.sh and jobsync-backup.sh from the same commit as this script, and
# jobsync-backup.pub — the public half of the Mac's backup key (one line, ed25519).
#
# What it changes — a copy of every changed file first (*.bak-<UTC>):
#   /usr/local/bin/jobsync-deploy        the wrapper, now telling the backup key from the others
#   /usr/local/bin/jobsync-backup        new: the copy itself
#   /etc/jobsync/backup-key.pub          new: which key is the backup key (root, 644)
#   ~svc-jobsync/.ssh/authorized_keys    + the backup key: restrict, the same forced command
#   /etc/ssh/sshd_config.d/90-jobsync-deploy.conf
#                                        + ExposeAuthInfo yes in the svc-jobsync block (sshd then
#                                        tells the wrapper which key signed in)
# sshd is reloaded only after sshd -t and sshd -T agree: ExposeAuthInfo yes and the forced command
# for svc-jobsync, no for ops. Otherwise the sshd file is put back and nothing is reloaded.
# A second run changes nothing. Prints no secrets: there are none here.
set -euo pipefail
umask 022

# The two scripts this install was written for (skillklan/tests/backup-sshd.test.sh runs it, so a
# script changed without these lines fails CI).
DEPLOY_SHA256=fe95dd154f259f6d873a33e49498d545f3be7ea82188f0ef372e8f0654cdafd2
BACKUP_SHA256=7dba7d50ceaff375d03a6bb57ceebf0c650828e471a56aa8988b43c230d4382c

SVC_USER="svc-jobsync"
WRAPPER=/usr/local/bin/jobsync-deploy
COPIER=/usr/local/bin/jobsync-backup
KEY_FILE=/etc/jobsync/backup-key.pub
SSHD_CONF=/etc/ssh/sshd_config.d/90-jobsync-deploy.conf
KEY_NAME=jobsync-backup
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

say() { printf '%s\n' "$*"; }
die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
sha() { sha256sum "$1" | cut -d' ' -f1; }
keep_copy() { [ -e "$1" ] && cp -p "$1" "$1.bak-$STAMP" && say "  copy: $1.bak-$STAMP"; return 0; }

SRC="${1:-}"
[ -n "$SRC" ] || die "usage: sudo bash $0 <folder with jobsync-deploy.sh, jobsync-backup.sh, jobsync-backup.pub>"
[ "$(id -u)" = 0 ] || die "run as root: sudo bash $0 $SRC"

# --- checks: nothing is changed until all of them pass ----------------------------------------
for f in jobsync-deploy.sh jobsync-backup.sh jobsync-backup.pub; do [ -f "$SRC/$f" ] || die "no $SRC/$f"; done
[ "$(sha "$SRC/jobsync-deploy.sh")" = "$DEPLOY_SHA256" ] || die "jobsync-deploy.sh is not the one this install was written for"
[ "$(sha "$SRC/jobsync-backup.sh")" = "$BACKUP_SHA256" ] || die "jobsync-backup.sh is not the one this install was written for"

[ "$(grep -c . "$SRC/jobsync-backup.pub")" = 1 ] || die "jobsync-backup.pub: expected one line"
read -r ktype kbody _ < "$SRC/jobsync-backup.pub"
[ "$ktype" = ssh-ed25519 ] && [[ "$kbody" =~ ^AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]+=*$ ]] \
  || die "jobsync-backup.pub is not an ed25519 public key"
fingerprint="$(ssh-keygen -lf "$SRC/jobsync-backup.pub" | awk '{ print $2 }')" || die "jobsync-backup.pub: not a valid key"

home="$(getent passwd "$SVC_USER" | cut -d: -f6)"
[ -n "$home" ] || die "no user $SVC_USER"
AUTH_KEYS="$home/.ssh/authorized_keys"
[ -f "$AUTH_KEYS" ] || die "no $AUTH_KEYS"
key_line="$(grep -F " $kbody" "$AUTH_KEYS" || true)"
if [ -n "$key_line" ] && [[ "$key_line" != *" $KEY_NAME" ]]; then
  die "this key already signs in to $SVC_USER as another key (a deploy key?) — make a separate one for the backup"
fi

[ -f "$SSHD_CONF" ] || die "no $SSHD_CONF"
grep -qE "^[[:space:]]*Match[[:space:]]+User[[:space:]]+${SVC_USER}[[:space:]]*\$" "$SSHD_CONF" || die "$SSHD_CONF: no 'Match User $SVC_USER'"
grep -qE "^[[:space:]]*ForceCommand[[:space:]]+${WRAPPER}[[:space:]]*\$" "$SSHD_CONF" || die "$SSHD_CONF: no 'ForceCommand $WRAPPER'"
sshd -t || die "sshd -t fails before any change — not touching it"

# --- changes ----------------------------------------------------------------------------------
changed=0
say "scripts:"
for pair in "jobsync-deploy.sh:$WRAPPER" "jobsync-backup.sh:$COPIER"; do
  from="$SRC/${pair%%:*}"; to="${pair#*:}"
  if [ -f "$to" ] && [ "$(sha "$to")" = "$(sha "$from")" ]; then say "  $to — already this one"; continue; fi
  keep_copy "$to"
  install -o root -g root -m 755 "$from" "$to"; changed=1
  say "  $to — installed, sha256 $(sha "$to")"
done

say "backup key:"
install -d -o root -g root -m 755 "$(dirname "$KEY_FILE")"
want_key="ssh-ed25519 $kbody $KEY_NAME"
if [ -f "$KEY_FILE" ] && [ "$(cat "$KEY_FILE")" = "$want_key" ]; then say "  $KEY_FILE — already this key"
else
  keep_copy "$KEY_FILE"
  printf '%s\n' "$want_key" > "$KEY_FILE.tmp" && chown root:root "$KEY_FILE.tmp" && chmod 644 "$KEY_FILE.tmp" && mv -f "$KEY_FILE.tmp" "$KEY_FILE"
  changed=1; say "  $KEY_FILE — $fingerprint"
fi
if [ -n "$key_line" ]; then say "  $AUTH_KEYS — already has it"
else
  keep_copy "$AUTH_KEYS"
  # A file without a final line break would glue the new key to the last one.
  [ -z "$(tail -c 1 "$AUTH_KEYS")" ] || printf '\n' >> "$AUTH_KEYS"
  printf 'restrict,command="%s" %s\n' "$WRAPPER" "$want_key" >> "$AUTH_KEYS"
  changed=1; say "  $AUTH_KEYS — added ($(stat -c '%U %a' "$AUTH_KEYS"))"
fi

say "sshd:"
probe() { sshd -T -C "user=$1,host=backup-check.invalid,addr=203.0.113.10" 2> /dev/null; }
sshd_ok() {
  local svc ops
  svc="$(probe "$SVC_USER")" && ops="$(probe ops)" || return 1
  grep -qx 'exposeauthinfo yes' <<< "$svc" && grep -qx "forcecommand $WRAPPER" <<< "$svc" \
    && grep -qx 'exposeauthinfo no' <<< "$ops" && ! grep -qx "forcecommand $WRAPPER" <<< "$ops"
}
if sshd_ok; then say "  ExposeAuthInfo — already on for $SVC_USER"
else
  conf_copy="/root/$(basename "$SSHD_CONF").bak-$STAMP"
  cp -p "$SSHD_CONF" "$conf_copy" && say "  copy: $conf_copy"
  sed -i -E "s|^([[:space:]]*)ForceCommand[[:space:]]+${WRAPPER}[[:space:]]*\$|&\n\1ExposeAuthInfo yes|" "$SSHD_CONF"
  if ! sshd -t || ! sshd_ok; then
    cp -p "$conf_copy" "$SSHD_CONF"
    die "sshd did not accept ExposeAuthInfo as expected — $SSHD_CONF put back, sshd not reloaded"
  fi
  if systemctl is-active --quiet ssh; then systemctl reload ssh; say "  ssh reloaded"
  else say "  ssh is not running now — the next connection reads the new settings"; fi
  changed=1; say "  ExposeAuthInfo yes for $SVC_USER (ops: no)"
fi

[ "$changed" = 1 ] && say "OK: the Mac's copy of /data is switched on" || say "OK: nothing to change"
