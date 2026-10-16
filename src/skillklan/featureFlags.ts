import "server-only";
import { cache } from "react";
import prisma from "@/lib/db";
import { type FeatureFlags, type FeatureKey, resolveFeatureFlags } from "./features";

// The switches as they are now: defaults from src/skillklan/features.ts,
// overridden by the admin's choices. Once per request — the layout, the page
// and server actions of one render share one read.
export const getFeatureFlags = cache(readFeatureFlags);

// Uncached — right after a change, the cached value of this request is stale.
export async function readFeatureFlags(): Promise<FeatureFlags> {
  const rows = await prisma.featureToggle.findMany({
    select: { key: true, enabled: true },
  });
  return resolveFeatureFlags(rows);
}

// A switched-off part refuses on the server too — every change to it, not
// only its menu item: a page opened before the switch went off keeps its
// buttons until it is reloaded.
export async function isFeatureOff(key: FeatureKey): Promise<boolean> {
  return !(await getFeatureFlags())[key];
}
