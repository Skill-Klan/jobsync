-- Add Work.ua and Robota.ua to the accounts that already exist, to match the
-- new defaults (JOB_SOURCES in src/lib/constants.ts). Data only — no schema
-- change. uuid() is client-side, so ids are generated here. A person who
-- already has a source with the same value keeps theirs; no duplicate.
INSERT INTO "JobSource" ("id", "label", "value", "createdBy")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), n."label", n."value", u."id"
FROM "User" u
CROSS JOIN (
  SELECT 'Work.ua' AS "label", 'work.ua' AS "value"
  UNION ALL SELECT 'Robota.ua', 'robota.ua'
) n
WHERE NOT EXISTS (
  SELECT 1 FROM "JobSource" s WHERE s."createdBy" = u."id" AND s."value" = n."value"
);
