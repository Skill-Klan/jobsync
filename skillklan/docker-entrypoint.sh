#!/bin/sh
# skillklan: entrypoint форку. На відміну від апстріму:
#  - процес уже не root (USER 1001 у Dockerfile.skillklan) — без chown і su;
#  - Prisma CLI вбудовано в образ — жодних завантажень із npm під час старту;
#  - fail closed: без справжніх секретів не стартуємо (апстрім генерував тимчасовий
#    AUTH_SECRET, а compose апстріму підставляв публічні плейсхолдери).
set -eu

for name in AUTH_SECRET ENCRYPTION_KEY; do
  value="$(printenv "$name" || true)"
  case "$value" in
    "" | your-auth-secret | you-encryption-key-here)
      echo "FATAL: $name is empty or a known placeholder; refusing to start" >&2
      exit 64
      ;;
  esac
done

node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

exec node server.js
