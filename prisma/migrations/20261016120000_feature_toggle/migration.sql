-- SkillKlan feature switches (owner 2026-10-16): an admin turns parts of the
-- app on or off for everyone in Settings → «Функції». One row per switch the
-- admin has touched; no row means the default in src/skillklan/features.ts —
-- so this migration adds no rows, and "Activities" starts off by that default.
-- CreateTable
CREATE TABLE "FeatureToggle" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedByCabinetUserId" INTEGER
);
