import { MESSAGES } from "./messages";

// A key missing in the current language shows the English text instead of a
// raw key like "nav.jobs". The parity test keeps both dictionaries in step,
// so this is a safety net, not a way of working.
export function fallbackMessage({ namespace, key }: { namespace?: string; key: string }): string {
  const path = [namespace, key].filter(Boolean).join(".").split(".");
  let node: unknown = MESSAGES.en;
  for (const part of path) {
    if (node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, part)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return path.join(".");
    }
  }
  return typeof node === "string" ? node : path.join(".");
}
