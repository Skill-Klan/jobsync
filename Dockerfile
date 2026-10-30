# Образ SkillKlan Job (єдиний Dockerfile репозиторію з 2026-10-14; апстрімний прибрано).
# Базовий образ за digest; Prisma CLI в образі (без npx на старті); процес — uid 1001 від самого
# початку; entrypoint — skillklan/docker-entrypoint.sh (fail closed без справжніх секретів).

# node:24.22.2-alpine (індекс, multi-arch). Node 24 — LTS до 2028-04-30; Node 20 без підтримки з 2026-04-30.
# Не нижче 24.22.1: перша з undici 7.30.1 за глобальним fetch (тест — nodeRuntimeVersion.spec.ts).
FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/data/dev.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Prisma CLI тієї ж версії, що в package-lock.json (перевіряє CI) — ставиться під час ЗБИРАННЯ,
# разом із рушіями під цю платформу.
FROM base AS prismacli
ARG PRISMA_VERSION=6.19.0
WORKDIR /opt/prisma
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}" \
 && npm cache clean --force

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3737 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/nextjs \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 -G nodejs -h /home/nextjs nextjs \
 && mkdir -p /data/files/resumes /app/.next /home/nextjs \
 && chown -R nextjs:nodejs /data /app/.next /home/nextjs

COPY --from=prismacli --chown=root:root /opt/prisma /opt/prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY skillklan/docker-entrypoint.sh /app/skillklan-entrypoint.sh
# без `COPY --chmod`: той потребує BuildKit, а локальний збирач (colima) — класичний
RUN chmod 0755 /app/skillklan-entrypoint.sh

USER 1001:1001
EXPOSE 3737
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3737/ || exit 1
ENTRYPOINT ["/app/skillklan-entrypoint.sh"]
