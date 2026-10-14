import type { Locale } from "../config";
import enAccount from "./en/account.json";
import enActivities from "./en/activities.json";
import enAgent from "./en/agent.json";
import enAuth from "./en/auth.json";
import enAutomations from "./en/automations.json";
import enCommon from "./en/common.json";
import enDashboard from "./en/dashboard.json";
import enInterviews from "./en/interviews.json";
import enJobs from "./en/jobs.json";
import enLabels from "./en/labels.json";
import enLibrary from "./en/library.json";
import enNav from "./en/nav.json";
import enNotifications from "./en/notifications.json";
import enProfile from "./en/profile.json";
import enQuestions from "./en/questions.json";
import enSettings from "./en/settings.json";
import enTasks from "./en/tasks.json";
import enValidation from "./en/validation.json";
import ukAccount from "./uk/account.json";
import ukActivities from "./uk/activities.json";
import ukAgent from "./uk/agent.json";
import ukAuth from "./uk/auth.json";
import ukAutomations from "./uk/automations.json";
import ukCommon from "./uk/common.json";
import ukDashboard from "./uk/dashboard.json";
import ukInterviews from "./uk/interviews.json";
import ukJobs from "./uk/jobs.json";
import ukLabels from "./uk/labels.json";
import ukLibrary from "./uk/library.json";
import ukNav from "./uk/nav.json";
import ukNotifications from "./uk/notifications.json";
import ukProfile from "./uk/profile.json";
import ukQuestions from "./uk/questions.json";
import ukSettings from "./uk/settings.json";
import ukTasks from "./uk/tasks.json";
import ukValidation from "./uk/validation.json";

// One JSON file per area and language: `uk/<area>.json` and `en/<area>.json`
// carry the same keys (checked by __tests__/i18n/messages.spec.ts). Every area
// is registered here up front, so areas can be translated in parallel without
// touching this file.
const en = {
  account: enAccount,
  activities: enActivities,
  agent: enAgent,
  auth: enAuth,
  automations: enAutomations,
  common: enCommon,
  dashboard: enDashboard,
  interviews: enInterviews,
  jobs: enJobs,
  labels: enLabels,
  library: enLibrary,
  nav: enNav,
  notifications: enNotifications,
  profile: enProfile,
  questions: enQuestions,
  settings: enSettings,
  tasks: enTasks,
  validation: enValidation,
};

const uk: typeof en = {
  account: ukAccount,
  activities: ukActivities,
  agent: ukAgent,
  auth: ukAuth,
  automations: ukAutomations,
  common: ukCommon,
  dashboard: ukDashboard,
  interviews: ukInterviews,
  jobs: ukJobs,
  labels: ukLabels,
  library: ukLibrary,
  nav: ukNav,
  notifications: ukNotifications,
  profile: ukProfile,
  questions: ukQuestions,
  settings: ukSettings,
  tasks: ukTasks,
  validation: ukValidation,
};

export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = { uk, en };
