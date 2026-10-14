import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

// The locale of the current request. Outside a request (build, scripts)
// there are no cookies — that is the default locale, not an error.
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return resolveLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return resolveLocale(undefined);
  }
}
