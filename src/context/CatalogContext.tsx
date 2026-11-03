"use client";

import { createContext, useContext } from "react";
import type { CatalogEntryView } from "@/skillklan/catalog/kinds";

// The shared catalog for the browser (src/skillklan/catalog). The dashboard
// layout reads it on the server while the `catalog` switch is on and provides
// it here; `null` means "no catalog" — the job form then works as it always did.
const CatalogContext = createContext<CatalogEntryView[] | null>(null);

export function CatalogProvider({
  value,
  children,
}: {
  value: CatalogEntryView[] | null;
  children: React.ReactNode;
}) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogEntryView[] | null {
  return useContext(CatalogContext);
}
