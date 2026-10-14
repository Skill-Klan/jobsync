import type { Locale } from "./config";
import type { Messages } from "./messages";

// Message keys are checked by the compiler: t("nav.jobz") does not build.
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
