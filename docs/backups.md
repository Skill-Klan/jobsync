# Backups — the copy of `/data` off Server2

`/data` is everything this app keeps: the SQLite database (`dev.db`) and the files people upload —
resumes, a person's own exports. Two kinds of copies exist:

| | Where | When | Against |
|---|---|---|---|
| Before a deploy | Server2, `~svc-jobsync/jobsync/backups/` (the last 10) | every deploy, with the old version stopped | a release that breaks the data — `jobsync-deploy` rolls back with it |
| **Daily (D11)** | **the owner's Mac** | once a day, the Mac pulls it | losing Server2 itself |

## Who may take the daily copy

The Mac signs in to Server2 as `svc-jobsync` with **a key of its own**. sshd forces every key of that
user into `jobsync-deploy`; with `ExposeAuthInfo` it also tells the wrapper which key signed in. The key
named in `/etc/jobsync/backup-key.pub` goes to `jobsync-backup` and can do **one thing — `backup`**: no
deploy, no status, no shell. Every other key (the deploy keys) stays in `jobsync-deploy` and **cannot take
a copy** — the copy holds the students' resumes, and the deploy keys live in GitHub. Anything unexpected
(no auth info, no key file, two keys) counts as "not the backup key".

The Mac pulls; the server has no way into the Mac.

## What `backup` sends

A tar of `/data` on stdout, and nothing else there (messages go to stderr):

| Entry | |
|---|---|
| `dev.db` | the database through SQLite's online backup — consistent while the app writes, no downtime; a write in progress is not in it; `PRAGMA integrity_check` before it is sent |
| `files/…`, `backups/…` | every other file as it is (hard links into a staging folder, so a file rewritten meanwhile does not change the copy) |
| `.backup-sha256` | the sha256 of every file above, `shasum -c` format |
| `.backup-tables` | `<table>\t<rows>` for every table of `dev.db`, counted at the moment of the snapshot |

The receiver proves the copy whole by the last two — every file's sha256, nothing extra or missing, the
database intact and every table with the rows the server counted — **not by its size**: a cut transfer of
a big file passes any size threshold. The staging folder `/data/.snapshot` is removed after the copy and
after a failure. The snapshot runs in the app's own container (its Node, `node:sqlite`), so the host needs
no SQLite tools; `image-smoke.sh` R8 fails an image that cannot take it.

A copy and a deploy never overlap: during a deploy a copy is refused at once (the deploy may be restoring
`/data`); a deploy that starts during a copy waits for it (`.backup.lock`, up to 5 minutes) instead of
failing the release.

## Install on Server2 (the owner, once)

Needs `sudo`. Put `jobsync-deploy.sh`, `jobsync-backup.sh` (from `skillklan/deploy/`, the same commit),
`skillklan/server/jobsync-backup-install.sh` and the Mac key's public half as `jobsync-backup.pub` in one
folder, then:

```bash
sudo bash jobsync-backup-install.sh <folder>
```

It checks everything before it changes anything (the scripts' sha256, the key, the sshd block), keeps a copy
of every file it changes (`*.bak-<UTC>`), reloads sshd only after `sshd -t` and `sshd -T` agree, and puts the
sshd file back if they don't. A second run changes nothing.

## Restore

The archive is `/data` itself. Into an empty volume, as root of the container (the files belong to uid 1001):

```bash
gzip -dc jobsync-data.tar.gz | docker run --rm -i --network none -v <volume>:/data --user 0 \
  --entrypoint sh ghcr.io/skill-klan/jobsync@<digest> \
  -c 'tar -C /data -xpf - && rm -f /data/.backup-sha256 /data/.backup-tables'
```

On Server2 the volume is `jobsync_data`: stop the app first; the owner runs it as `svc-jobsync` with the
rootless Docker variables (`XDG_RUNTIME_DIR`, `DOCKER_HOST`, as `jobsync-deploy` sets them). Restore with the
image deployed now or a newer one: a newer image migrates the database forward on start, an older one may not
read it.

## Tests

| File | Runs in | What |
|---|---|---|
| `skillklan/tests/backup.test.sh` | CI, Node 24 | B1–B8: the copy is whole and only the backup key gets it; locks; cleanup; a write in progress |
| `skillklan/tests/backup-sshd.test.sh` | CI, a throwaway Ubuntu 24.04 container | S1–S8: the install and the key separation through a real sshd, as on Server2 |
| `skillklan/tests/image-smoke.sh` R8 | CI, the built image | the snapshot works in the image itself |
