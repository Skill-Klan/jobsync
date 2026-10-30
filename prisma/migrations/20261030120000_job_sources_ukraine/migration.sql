-- Bring the existing accounts in line with the new defaults (see
-- JOB_SOURCES in src/lib/constants.ts): add DOU and Djinni, drop the boards
-- that nobody uses on the Ukrainian market (owner, 2026-10-30). Data only —
-- no schema change. uuid() is client-side, so ids are generated here.
--
-- A removed board is a row that still has the seeded value AND the seeded
-- label: a source the person renamed is theirs and stays.

-- 1. A job on a removed board moves to the person's "Other". Make sure the
--    person has one (they may have deleted it) before anything points at it.
INSERT INTO "JobSource" ("id", "label", "value", "createdBy")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'Other', 'other', u."createdBy"
FROM (
  SELECT DISTINCT s."createdBy"
  FROM "JobSource" s
  WHERE (
    (s."value" = 'indeed' AND s."label" = 'Indeed') OR
    (s."value" = 'monster' AND s."label" = 'Monster') OR
    (s."value" = 'glassdoor' AND s."label" = 'Glassdoor') OR
    (s."value" = 'ziprecruiter' AND s."label" = 'ZipRecruiter') OR
    (s."value" = 'jobstreet' AND s."label" = 'Job Street')
  )
  AND EXISTS (SELECT 1 FROM "Job" j WHERE j."jobSourceId" = s."id")
  AND NOT EXISTS (
    SELECT 1 FROM "JobSource" o WHERE o."createdBy" = s."createdBy" AND o."value" = 'other'
  )
) u;

-- 2. Move the jobs.
UPDATE "Job"
SET "jobSourceId" = (
  SELECT o."id"
  FROM "JobSource" r
  JOIN "JobSource" o ON o."createdBy" = r."createdBy" AND o."value" = 'other'
  WHERE r."id" = "Job"."jobSourceId"
)
WHERE "jobSourceId" IN (
  SELECT s."id"
  FROM "JobSource" s
  WHERE (s."value" = 'indeed' AND s."label" = 'Indeed') OR
        (s."value" = 'monster' AND s."label" = 'Monster') OR
        (s."value" = 'glassdoor' AND s."label" = 'Glassdoor') OR
        (s."value" = 'ziprecruiter' AND s."label" = 'ZipRecruiter') OR
        (s."value" = 'jobstreet' AND s."label" = 'Job Street')
);

-- 3. Drop the removed boards; nothing points at them any more.
DELETE FROM "JobSource"
WHERE ("value" = 'indeed' AND "label" = 'Indeed') OR
      ("value" = 'monster' AND "label" = 'Monster') OR
      ("value" = 'glassdoor' AND "label" = 'Glassdoor') OR
      ("value" = 'ziprecruiter' AND "label" = 'ZipRecruiter') OR
      ("value" = 'jobstreet' AND "label" = 'Job Street');

-- 4. Add DOU and Djinni to everyone who does not have them yet (a source the
--    person made by hand with the same value is theirs; no duplicate).
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
  SELECT 'DOU' AS "label", 'dou' AS "value"
  UNION ALL SELECT 'Djinni', 'djinni'
) n
WHERE NOT EXISTS (
  SELECT 1 FROM "JobSource" s WHERE s."createdBy" = u."id" AND s."value" = n."value"
);
