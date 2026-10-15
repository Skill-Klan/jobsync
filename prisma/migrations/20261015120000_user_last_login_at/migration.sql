-- SkillKlan admin (JA2): when a person last came in from the cabinet. Each
-- SkillKlan Job session starts with a cabinet sign-in and lasts at most 8 h,
-- so this is "last seen" to within a working day — without writing on every
-- request. Null for accounts that predate the column until their next sign-in.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
