"use server";

import { getCurrentUser } from "@/utils/user.utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { ATS_TOKEN_REGEX } from "@/lib/scraper/utils";
import greenhouseSeed from "@/lib/scraper/greenhouse/companies.json";
import leverSeed from "@/lib/scraper/lever/companies.json";
import ashbySeed from "@/lib/scraper/ashby/companies.json";
import type { JobBoard, LeverHost } from "@/models/automation.model";
import { getTranslations } from "@/i18n/server";

// What a person reads is in their language; the translator is passed to
// the helpers below, which cannot await it themselves.
type LibraryT = Awaited<ReturnType<typeof getTranslations<"library">>>;

// `host` is present (optional) on Lever entries only; Greenhouse entries omit it.
type SeedCompany = { name: string; token: string; host?: LeverHost };

const SEEDS: Record<string, SeedCompany[]> = {
  greenhouse: greenhouseSeed,
  lever: leverSeed as SeedCompany[],
  ashby: ashbySeed as SeedCompany[],
};

type ResolveResult =
  | { success: true; name: string; token: string; host?: LeverHost }
  | { success: false; message: string };

// Typeahead over the seeded companies.json (server-side filter, paginated).
// An empty query browses the full list (alphabetical); `offset` drives the
// infinite-scroll load-more. Returns a page plus whether more remain.
export async function searchAtsCompanies(
  provider: JobBoard,
  query: string,
  offset = 0,
): Promise<{ companies: SeedCompany[]; hasMore: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { companies: [], hasMore: false };

  const seed = SEEDS[provider] ?? [];
  const q = query.trim().toLowerCase();
  const matches =
    q.length < 1
      ? seed
      : seed.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.token.toLowerCase().includes(q),
        );

  const companies = matches.slice(
    offset,
    offset + APP_CONSTANTS.ATS_COMPANY_PAGE_SIZE,
  );
  return { companies, hasMore: offset + companies.length < matches.length };
}

// Total number of companies in the seeded directory (for a browse hint).
export async function getAtsCompanyCount(provider: JobBoard): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  return (SEEDS[provider] ?? []).length;
}

// Validate a token or board URL; returns the display company name (and, for
// Lever, the resolved host). Dispatches per provider.
export async function resolveAtsBoard(
  provider: JobBoard,
  input: string,
): Promise<ResolveResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const t = await getTranslations("library");
  if (provider === "greenhouse") return resolveGreenhouse(t, input);
  if (provider === "lever") return resolveLever(t, input);
  if (provider === "ashby") return resolveAshby(t, input);
  return { success: false, message: "Unsupported provider" };
}

// Greenhouse: extract token from a board URL or bare token; validate via
// /boards/{token}; return the API's official name.
function extractGreenhouseToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i,
  );
  if (urlMatch) return urlMatch[1].toLowerCase();

  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const token = trimmed.toLowerCase();
    return ATS_TOKEN_REGEX.test(token) ? token : null;
  }

  return null;
}

async function resolveGreenhouse(
  t: LibraryT,
  input: string,
): Promise<ResolveResult> {
  const token = extractGreenhouseToken(input);
  if (!token) {
    return {
      success: false,
      message: t("errors.board.pasteGreenhouse"),
    };
  }

  try {
    const response = await fetch(
      `${APP_CONSTANTS.GREENHOUSE_BASE_URL}/${encodeURIComponent(token)}`,
    );

    if (response.status === 404) {
      return {
        success: false,
        message: t("errors.board.notFound", { provider: "Greenhouse", token }),
      };
    }
    if (!response.ok) {
      return {
        success: false,
        message: t("errors.board.validateFailed", { status: String(response.status) }),
      };
    }

    const data: { name?: string } = await response.json();
    const name = data.name?.trim();
    if (!name) {
      return { success: false, message: t("errors.board.noName") };
    }

    return { success: true, name, token };
  } catch {
    return {
      success: false,
      message: t("errors.board.unreachable", { provider: "Greenhouse" }),
    };
  }
}

// Lever: extract token (+ explicit EU host) from a jobs.lever.co /
// jobs.eu.lever.co URL or bare token; validate by probing the postings
// endpoint; resolve the display name from the seed or a humanized token.
function extractLeverToken(
  input: string,
): { token: string; host?: LeverHost } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/jobs\.(eu\.)?lever\.co\/([a-z0-9_-]+)/i);
  if (urlMatch) {
    return {
      token: urlMatch[2].toLowerCase(),
      host: urlMatch[1] ? "eu" : "default",
    };
  }

  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return { token: trimmed.toLowerCase() };
  }

  return null;
}

function humanizeToken(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function probeLeverBoard(
  token: string,
  host: LeverHost,
): Promise<boolean> {
  const base =
    host === "eu"
      ? APP_CONSTANTS.LEVER_EU_BASE_URL
      : APP_CONSTANTS.LEVER_BASE_URL;
  const res = await fetch(
    `${base}/${encodeURIComponent(token)}?mode=json&limit=1`,
  );
  return res.ok;
}

async function resolveLever(
  t: LibraryT,
  input: string,
): Promise<ResolveResult> {
  const extracted = extractLeverToken(input);
  if (!extracted) {
    return {
      success: false,
      message: t("errors.board.pasteLink", { host: "jobs.lever.co" }),
    };
  }

  const { token } = extracted;
  // Defense-in-depth: reject a malformed token before any fetch.
  if (!ATS_TOKEN_REGEX.test(token)) {
    return {
      success: false,
      message: t("errors.board.invalidToken", { provider: "Lever", token }),
    };
  }

  try {
    let host: LeverHost;
    if (extracted.host === "eu") {
      if (!(await probeLeverBoard(token, "eu"))) {
        return {
          success: false,
          message: t("errors.board.notFound", { provider: "Lever", token }),
        };
      }
      host = "eu";
    } else {
      // Bare token or default-host URL: probe default first, fall back to EU.
      if (await probeLeverBoard(token, "default")) {
        host = "default";
      } else if (await probeLeverBoard(token, "eu")) {
        host = "eu";
      } else {
        return {
          success: false,
          message: t("errors.board.notFound", { provider: "Lever", token }),
        };
      }
    }

    const seeded = (leverSeed as SeedCompany[]).find((c) => c.token === token);
    const name = seeded?.name ?? humanizeToken(token);
    return { success: true, name, token, host };
  } catch {
    return {
      success: false,
      message: t("errors.board.unreachable", { provider: "Lever" }),
    };
  }
}

// Ashby: extract the token from a jobs.ashbyhq.com URL (board or deep posting
// link) or a bare token; validate with a single call — an unknown board 404s,
// so there is nothing to probe. The payload carries no company name, so the
// display name comes from the seed or a humanized token, as with Lever.
function extractAshbyToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed.toLowerCase();
  }

  return null;
}

async function resolveAshby(
  t: LibraryT,
  input: string,
): Promise<ResolveResult> {
  const token = extractAshbyToken(input);
  if (!token) {
    return {
      success: false,
      message: t("errors.board.pasteLink", { host: "jobs.ashbyhq.com" }),
    };
  }

  // Defense-in-depth: reject a malformed token before any fetch.
  if (!ATS_TOKEN_REGEX.test(token)) {
    return {
      success: false,
      message: t("errors.board.invalidToken", { provider: "Ashby", token }),
    };
  }

  try {
    const res = await fetch(
      `${APP_CONSTANTS.ASHBY_BASE_URL}/${encodeURIComponent(token)}`,
    );
    res.body?.cancel(); // status is all we need; skip the full board payload

    if (res.status === 404) {
      return {
        success: false,
        message: t("errors.board.notFound", { provider: "Ashby", token }),
      };
    }
    if (!res.ok) {
      return {
        success: false,
        message: t("errors.board.validateFailed", { status: String(res.status) }),
      };
    }

    const seeded = (ashbySeed as SeedCompany[]).find((c) => c.token === token);
    return { success: true, name: seeded?.name ?? humanizeToken(token), token };
  } catch {
    return {
      success: false,
      message: t("errors.board.unreachable", { provider: "Ashby" }),
    };
  }
}
