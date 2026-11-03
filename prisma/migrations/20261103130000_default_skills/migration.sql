-- Give the accounts that already exist the default skills new accounts now start
-- with (DEFAULT_SKILLS in src/lib/constants.ts), so «Навички» in the job form is
-- not empty for them either. Data only — no schema change. uuid() is
-- client-side, so ids are generated here. A person who already has a tag with
-- the same value keeps theirs (their label, their jobs); no duplicate.
INSERT INTO "Tag" ("id", "label", "value", "createdBy")
SELECT lower(
  substr(hex(randomblob(16)), 1, 8) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 4) || '-' ||
  substr(hex(randomblob(16)), 1, 12)
), n."label", n."value", u."id"
FROM "User" u
CROSS JOIN (
  SELECT 'Manual Testing' AS "label", 'manual testing' AS "value"
  UNION ALL SELECT 'Test Cases', 'test cases'
  UNION ALL SELECT 'Bug Reporting', 'bug reporting'
  UNION ALL SELECT 'Test Design', 'test design'
  UNION ALL SELECT 'API Testing', 'api testing'
  UNION ALL SELECT 'Regression Testing', 'regression testing'
  UNION ALL SELECT 'Smoke Testing', 'smoke testing'
  UNION ALL SELECT 'Java', 'java'
  UNION ALL SELECT 'JavaScript', 'javascript'
  UNION ALL SELECT 'TypeScript', 'typescript'
  UNION ALL SELECT 'Python', 'python'
  UNION ALL SELECT 'SQL', 'sql'
  UNION ALL SELECT 'Git', 'git'
  UNION ALL SELECT 'Selenium', 'selenium'
  UNION ALL SELECT 'Playwright', 'playwright'
  UNION ALL SELECT 'Cypress', 'cypress'
  UNION ALL SELECT 'Appium', 'appium'
  UNION ALL SELECT 'TestNG', 'testng'
  UNION ALL SELECT 'JUnit', 'junit'
  UNION ALL SELECT 'Pytest', 'pytest'
  UNION ALL SELECT 'Postman', 'postman'
  UNION ALL SELECT 'REST API', 'rest api'
  UNION ALL SELECT 'Swagger', 'swagger'
  UNION ALL SELECT 'Charles', 'charles'
  UNION ALL SELECT 'Allure', 'allure'
  UNION ALL SELECT 'Maven', 'maven'
  UNION ALL SELECT 'Jenkins', 'jenkins'
  UNION ALL SELECT 'Docker', 'docker'
  UNION ALL SELECT 'CI/CD', 'ci/cd'
  UNION ALL SELECT 'Jira', 'jira'
  UNION ALL SELECT 'TestRail', 'testrail'
  UNION ALL SELECT 'Agile', 'agile'
  UNION ALL SELECT 'Scrum', 'scrum'
  UNION ALL SELECT 'Linux', 'linux'
  UNION ALL SELECT 'English', 'english'
) n
WHERE NOT EXISTS (
  SELECT 1 FROM "Tag" t WHERE t."createdBy" = u."id" AND t."value" = n."value"
);
