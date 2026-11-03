-- CreateTable
CREATE TABLE "CatalogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByCabinetUserId" INTEGER
);

-- CreateTable
CREATE TABLE "CatalogRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedByCabinetUserId" INTEGER,
    CONSTRAINT "CatalogRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CatalogEntry_kind_idx" ON "CatalogEntry"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogEntry_kind_value_key" ON "CatalogEntry"("kind", "value");

-- CreateIndex
CREATE INDEX "CatalogRequest_status_idx" ON "CatalogRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRequest_kind_value_requestedBy_key" ON "CatalogRequest"("kind", "value", "requestedBy");

-- Seed the catalog. Data only. uuid() is client-side, so ids are generated here.
-- The defaults first (they win a clash of labels), then everything two or more
-- accounts already share: a thing only one person typed (a typo, a test) is left
-- for the admin to add on purpose. The label of a shared value is the smallest
-- one, so it is the same on every run. Existing per-person rows are not touched.
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Linkedin', 'linkedin');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'DOU', 'dou');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Djinni', 'djinni');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Work.ua', 'work.ua');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Robota.ua', 'robota.ua');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Google', 'google');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Company Career page', 'careerpage');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', 'Other', 'other');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Manual Testing', 'manual testing');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Test Cases', 'test cases');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Bug Reporting', 'bug reporting');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Test Design', 'test design');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'API Testing', 'api testing');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Regression Testing', 'regression testing');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Smoke Testing', 'smoke testing');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Java', 'java');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'JavaScript', 'javascript');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'TypeScript', 'typescript');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Python', 'python');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'SQL', 'sql');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Git', 'git');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Selenium', 'selenium');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Playwright', 'playwright');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Cypress', 'cypress');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Appium', 'appium');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'TestNG', 'testng');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'JUnit', 'junit');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Pytest', 'pytest');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Postman', 'postman');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'REST API', 'rest api');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Swagger', 'swagger');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Charles', 'charles');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Allure', 'allure');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Maven', 'maven');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Jenkins', 'jenkins');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Docker', 'docker');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'CI/CD', 'ci/cd');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Jira', 'jira');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'TestRail', 'testrail');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Agile', 'agile');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Scrum', 'scrum');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'Linux', 'linux');
INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value") VALUES (lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', 'English', 'english');

INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobSource', MIN("label"), "value"
FROM "JobSource"
GROUP BY "value"
HAVING COUNT(DISTINCT "createdBy") >= 2;

INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'skill', MIN("label"), "value"
FROM "Tag"
GROUP BY "value"
HAVING COUNT(DISTINCT "createdBy") >= 2;

INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'company', MIN("label"), "value"
FROM "Company"
GROUP BY "value"
HAVING COUNT(DISTINCT "createdBy") >= 2;

INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'jobTitle', MIN("label"), "value"
FROM "JobTitle"
GROUP BY "value"
HAVING COUNT(DISTINCT "createdBy") >= 2;

INSERT OR IGNORE INTO "CatalogEntry" ("id", "kind", "label", "value")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), 'location', MIN("label"), "value"
FROM "Location"
GROUP BY "value"
HAVING COUNT(DISTINCT "createdBy") >= 2;
