"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

const ONE_YEAR_S = 365 * 24 * 60 * 60;

// The language switcher. Only a supported locale is stored; anything else is
// ignored, so the cookie can never hold something the app cannot render.
export async function setLocale(locale: string): Promise<boolean> {
  if (!isLocale(locale)) return false;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_S,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return true;
}
