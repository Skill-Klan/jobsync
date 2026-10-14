import type { Locale } from "../config";
import enAccount from "./en/account.json";
import enAuth from "./en/auth.json";
import enCommon from "./en/common.json";
import enNav from "./en/nav.json";
import ukAccount from "./uk/account.json";
import ukAuth from "./uk/auth.json";
import ukCommon from "./uk/common.json";
import ukNav from "./uk/nav.json";

// One JSON file per area and language: `uk/<area>.json` and `en/<area>.json`
// carry the same keys (checked by __tests__/i18n/messages.spec.ts). A new
// area = a pair of files + a line in each map below.
const en = {
  account: enAccount,
  auth: enAuth,
  common: enCommon,
  nav: enNav,
};

const uk: typeof en = {
  account: ukAccount,
  auth: ukAuth,
  common: ukCommon,
  nav: ukNav,
};

export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = { uk, en };
