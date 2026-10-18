// Back to the cabinet (owner 2026-10-18, D72): SkillKlan Job now opens in the
// cabinet's own tab (D71), and the menu has «Кабінет» to go back in one click
// however many pages were opened here. The address is the server's
// CABINET_URL — the same one the sign-in from the cabinet trusts.
//
// Only an http(s) address is a link; anything else (unset in development, a
// typo, «javascript:…») — no menu item.
export function cabinetLink(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.CABINET_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
