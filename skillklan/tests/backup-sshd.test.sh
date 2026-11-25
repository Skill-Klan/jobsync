#!/usr/bin/env bash
# skillklan: the Mac's copy of /data through a real sshd, as Server2 has it (Ubuntu 24.04,
# OpenSSH from its archive): the install script and the key separation it sets up. Requirement —
# D11: only the Mac's key may take the copy (it holds the students' resumes), and installing it
# must not change what the deploy keys and ops can do.
#
#   S1 the install switches it on: scripts at their sha256, the key file, the key in
#      authorized_keys, ExposeAuthInfo for svc-jobsync only; copies of what it changed
#   S2 the backup key, through sshd, gets the copy (stdout is the archive) — this is also where
#      the real format of $SSH_USER_AUTH is checked
#   S3 the backup key, through sshd, cannot deploy or ask the status
#   S4 a deploy key, through sshd, cannot take a copy — and still works (status)
#   S5 ops still signs in as before and is not given ExposeAuthInfo or a forced command
#   S6 a second run changes nothing (no new copies, one line for the key)
#   S7 the install refuses — and changes nothing — when: the scripts are not the ones it was
#      written for; the "backup key" is a deploy key; the sshd file has no svc-jobsync block
#   S8 sshd does not accept the new settings → the sshd file is put back and sshd is not reloaded
#
# Run as root in a throwaway Ubuntu 24.04 container (it installs openssh-server and creates users):
#   docker run --rm -v "$PWD:/repo:ro" ubuntu:24.04 bash /repo/skillklan/tests/backup-sshd.test.sh
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FAILS=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }
[ "$(id -u)" = 0 ] && [ -f /.dockerenv ] || { echo "run as root in a throwaway container"; exit 2; }

export DEBIAN_FRONTEND=noninteractive
apt-get -qq update > /dev/null && apt-get -qq install -y --no-install-recommends openssh-server openssh-client procps > /dev/null \
  || { echo "apt failed"; exit 2; }
sshd -V 2>&1 | head -1

# --- Server2 as it is before the install ---------------------------------------------------
useradd -m -s /bin/bash ops; useradd -m -s /bin/bash svc-jobsync
mkdir -p /run/sshd; ssh-keygen -A > /dev/null
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers ops svc-jobsync
EOF
cat > /etc/ssh/sshd_config.d/90-jobsync-deploy.conf <<'EOF'
Match User svc-jobsync
    ForceCommand /usr/local/bin/jobsync-deploy
    PermitTTY no
    AllowTcpForwarding no
    AllowAgentForwarding no
    X11Forwarding no
EOF
K=/tmp/keys; mkdir -p "$K"
for k in ops deploy backup; do ssh-keygen -q -t ed25519 -N '' -C "$k" -f "$K/$k"; done
install -d -o ops -g ops -m 700 /home/ops/.ssh; install -o ops -g ops -m 600 "$K/ops.pub" /home/ops/.ssh/authorized_keys
install -d -o svc-jobsync -g svc-jobsync -m 700 /home/svc-jobsync/.ssh
printf 'restrict,command="/usr/local/bin/jobsync-deploy" %s' "$(cat "$K/deploy.pub")" > /home/svc-jobsync/.ssh/authorized_keys # no final line break
chown svc-jobsync:svc-jobsync /home/svc-jobsync/.ssh/authorized_keys; chmod 600 /home/svc-jobsync/.ssh/authorized_keys
echo "the wrapper before the install" > /usr/local/bin/jobsync-deploy; chmod 755 /usr/local/bin/jobsync-deploy

# The app: a fake docker whose "container" sends a fixed archive; healthy for status.
install -d -o svc-jobsync -g svc-jobsync -m 750 /home/svc-jobsync/jobsync
echo "JOBSYNC_DIGEST=sha256:$(printf 'a%.0s' $(seq 64))" > /home/svc-jobsync/jobsync/.env
: > /home/svc-jobsync/jobsync/compose.yaml; chown -R svc-jobsync:svc-jobsync /home/svc-jobsync/jobsync
mkdir -p /srv/fixture; echo SNAPSHOT-FIXTURE > /srv/fixture/.backup-sha256
cat > /usr/local/bin/docker <<'EOF'
#!/usr/bin/env bash
case "$1" in
  compose) echo cid-app ;;
  inspect) echo true ;;
  exec) case "$*" in *" node "*) cat > /dev/null ;; *" tar "*) tar -C /srv/fixture -cf - . ;; esac ;;
esac
EOF
cat > /usr/local/bin/curl <<'EOF'
#!/usr/bin/env bash
echo '{"cabinet":{"id":"cabinet"}}'
EOF
# systemd is not in the container: "reload ssh" is a HUP to the listening sshd.
cat > /usr/local/bin/systemctl <<'EOF'
#!/usr/bin/env bash
echo "systemctl $*" >> /tmp/systemctl.calls
case "$1" in is-active) exit 0 ;; reload) pkill -HUP -o -x sshd ;; esac
EOF
chmod 755 /usr/local/bin/docker /usr/local/bin/curl /usr/local/bin/systemctl
: > /tmp/systemctl.calls
/usr/sbin/sshd || { echo "sshd did not start"; exit 2; }

SSH=(ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p 22)
as_key() { local key="$1" user="$2"; shift 2; "${SSH[@]}" -i "$K/$key" "$user@127.0.0.1" "$@"; }
probe() { sshd -T -C "user=$1,host=t.invalid,addr=203.0.113.10" 2> /dev/null; }

# The install folder, as the owner would have it in ~ops.
SRC=/tmp/src; mkdir -p "$SRC"
cp "$ROOT/skillklan/deploy/jobsync-deploy.sh" "$ROOT/skillklan/deploy/jobsync-backup.sh" "$SRC/"
cp "$K/backup.pub" "$SRC/jobsync-backup.pub"
INSTALL="${INSTALL:-$ROOT/skillklan/server/jobsync-backup-install.sh}"
state() { # what the install may touch, as one fingerprint
  sha256sum /usr/local/bin/jobsync-deploy /usr/local/bin/jobsync-backup /etc/jobsync/backup-key.pub \
    /home/svc-jobsync/.ssh/authorized_keys /etc/ssh/sshd_config.d/90-jobsync-deploy.conf 2> /dev/null
  find / -xdev -name '*.bak-*' 2> /dev/null | sort
}

# --- S7 first: refusals on the untouched server ----------------------------------------------
before="$(state)"; bad=0
cp -r "$SRC" /tmp/src-wrong; echo "# changed" >> /tmp/src-wrong/jobsync-backup.sh
bash "$INSTALL" /tmp/src-wrong > /tmp/out 2>&1 && { bad=1; echo "     accepted other scripts"; }
cp -r "$SRC" /tmp/src-deploykey; cp "$K/deploy.pub" /tmp/src-deploykey/jobsync-backup.pub
bash "$INSTALL" /tmp/src-deploykey > /tmp/out 2>&1 && { bad=1; echo "     accepted a deploy key as the backup key"; }
mv /etc/ssh/sshd_config.d/90-jobsync-deploy.conf /tmp/90.conf; echo "# nothing" > /etc/ssh/sshd_config.d/90-jobsync-deploy.conf
bash "$INSTALL" "$SRC" > /tmp/out 2>&1 && { bad=1; echo "     accepted an sshd file without the svc-jobsync block"; }
mv /tmp/90.conf /etc/ssh/sshd_config.d/90-jobsync-deploy.conf
[ "$(state)" = "$before" ] || { bad=1; echo "     something changed"; }
[ "$bad" = 0 ] && pass "S7 the install refuses foreign scripts, a deploy key, a missing sshd block — and changes nothing" \
  || fail "S7 refusals"

# --- S8: sshd does not accept the result → put back, not reloaded -----------------------------
# A drop-in sorted after 90- that breaks sshd -t only once ExposeAuthInfo is there is hard to
# make; a broken one at any time is refused before any change (sshd -t first), so break sshd -t
# between the check and the edit: a fake sshd that fails -t only for the second call.
mkdir -p /tmp/s8bin
cat > /tmp/s8bin/sshd <<'EOF'
#!/usr/bin/env bash
if [ "$1" = -t ]; then n=$(cat /tmp/s8.n 2>/dev/null || echo 0); echo $((n + 1)) > /tmp/s8.n; [ "$n" -ge 1 ] && exit 1; fi
exec /usr/sbin/sshd "$@"
EOF
chmod 755 /tmp/s8bin/sshd; rm -f /tmp/s8.n
conf_before="$(sha256sum < /etc/ssh/sshd_config.d/90-jobsync-deploy.conf)"
PATH="/tmp/s8bin:$PATH" bash "$INSTALL" "$SRC" > /tmp/out 2>&1; rc=$?
if [ "$rc" != 0 ] && grep -q "put back" /tmp/out && [ "$(sha256sum < /etc/ssh/sshd_config.d/90-jobsync-deploy.conf)" = "$conf_before" ] \
   && ! grep -q reload /tmp/systemctl.calls; then pass "S8 sshd refuses the new settings → its file is put back, no reload"
else fail "S8 rollback (rc=$rc)"; sed 's/^/     | /' /tmp/out; fi
# S8 got as far as the scripts and keys (they are installed before sshd): that is the state S1 checks.

# --- S1 -----------------------------------------------------------------------------------
bash "$INSTALL" "$SRC" > /tmp/out 2>&1; rc=$?
ak=/home/svc-jobsync/.ssh/authorized_keys
ok=1
[ "$rc" = 0 ] || ok=0
[ "$(sha256sum < /usr/local/bin/jobsync-deploy)" = "$(sha256sum < "$SRC/jobsync-deploy.sh")" ] || ok=0
[ "$(sha256sum < /usr/local/bin/jobsync-backup)" = "$(sha256sum < "$SRC/jobsync-backup.sh")" ] || ok=0
[ "$(stat -c '%U %a' /usr/local/bin/jobsync-backup /etc/jobsync/backup-key.pub | tr '\n' ' ')" = "root 755 root 644 " ] || ok=0
[ "$(awk '{ print $2 }' /etc/jobsync/backup-key.pub)" = "$(awk '{ print $2 }' "$K/backup.pub")" ] || ok=0
[ "$(grep -c . "$ak")" = 2 ] && grep -q "deploy$" "$ak" && grep -q "^restrict,command=\"/usr/local/bin/jobsync-deploy\" ssh-ed25519 .* jobsync-backup$" "$ak" || ok=0
[ "$(stat -c '%U %a' "$ak")" = "svc-jobsync 600" ] || ok=0
probe svc-jobsync | grep -qx 'exposeauthinfo yes' || ok=0
ls /usr/local/bin/jobsync-deploy.bak-* "$ak".bak-* /root/90-jobsync-deploy.conf.bak-* > /dev/null 2>&1 || ok=0
grep -q "reload ssh" /tmp/systemctl.calls || ok=0
[ "$ok" = 1 ] && pass "S1 the install switches the copy on, keeping copies of what it changed" \
  || { fail "S1 install (rc=$rc)"; sed 's/^/     | /' /tmp/out; }
/bin/sleep 1 # sshd re-reads its settings on HUP

# --- S2 -----------------------------------------------------------------------------------
as_key backup svc-jobsync backup > /tmp/copy.tar 2> /tmp/copy.err; rc=$?
if [ "$rc" = 0 ] && tar -tf /tmp/copy.tar 2> /dev/null | grep -qx './.backup-sha256' \
   && tar -xOf /tmp/copy.tar ./.backup-sha256 | grep -q SNAPSHOT-FIXTURE; then
  pass "S2 the backup key gets the copy through sshd (real \$SSH_USER_AUTH)"
else fail "S2 copy through sshd (rc=$rc)"; sed 's/^/     | /' /tmp/copy.err; fi

# --- S3 -----------------------------------------------------------------------------------
bad=0
for cmd in "deploy sha256:$(printf 'b%.0s' $(seq 64))" "status" "id"; do
  as_key backup svc-jobsync "$cmd" > /tmp/out 2>&1 && { bad=1; echo "     backup key ran: $cmd"; }
done
[ "$bad" = 0 ] && pass "S3 the backup key cannot deploy or ask the status" || fail "S3 the backup key did more than the copy"

# --- S4 -----------------------------------------------------------------------------------
as_key deploy svc-jobsync backup > /tmp/out 2>&1; rc_copy=$?
grep -q SNAPSHOT-FIXTURE /tmp/out && leaked=yes || leaked=no
as_key deploy svc-jobsync status > /tmp/status 2>&1; rc_status=$?
if [ "$rc_copy" != 0 ] && [ "$leaked" = no ] && [ "$rc_status" = 0 ] && grep -q "health: ok" /tmp/status; then
  pass "S4 a deploy key cannot take a copy, and still works"
else fail "S4 deploy key (copy rc=$rc_copy leaked=$leaked status rc=$rc_status)"; sed 's/^/     | /' /tmp/status; fi

# --- S5 -----------------------------------------------------------------------------------
out_ops="$(as_key ops ops 'echo signed-in' 2>&1)"
if [ "$out_ops" = signed-in ] && probe ops | grep -qx 'exposeauthinfo no' && ! probe ops | grep -qx 'forcecommand /usr/local/bin/jobsync-deploy'; then
  pass "S5 ops signs in as before; no ExposeAuthInfo, no forced command"
else fail "S5 ops ($out_ops)"; fi

# --- S6 -----------------------------------------------------------------------------------
before="$(state)"; : > /tmp/systemctl.calls
bash "$INSTALL" "$SRC" > /tmp/out 2>&1; rc=$?
if [ "$rc" = 0 ] && grep -q "nothing to change" /tmp/out && [ "$(state)" = "$before" ] && ! grep -q reload /tmp/systemctl.calls; then
  pass "S6 a second run changes nothing"
else fail "S6 second run (rc=$rc)"; sed 's/^/     | /' /tmp/out; fi

echo "---- $FAILS failed"
[ "$FAILS" -eq 0 ]
