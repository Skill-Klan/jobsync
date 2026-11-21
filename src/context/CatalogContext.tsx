"use client";

import { createContext, useContext } from "react";
import type { CatalogEntryView, CatalogKind } from "@/skillklan/catalog/kinds";

// The shared catalog for the browser (src/skillklan/catalog). The dashboard
// layout reads it on the server while the `catalog` switch is on and provides
// it here; `null` means "no catalog" — the job form then works as it always did.
const CatalogContext = createContext<CatalogEntryView[] | null>(null);

// What the person created and the admin has not answered yet: still offered in
// their pickers (SKD-59).
export type PendingValue = { kind: CatalogKind; value: string };
const PendingContext = createContext<PendingValue[]>([]);

export function CatalogProvider({
  value,
  pending = [],
  children,
}: {
  value: CatalogEntryView[] | null;
  pending?: PendingValue[];
  children: React.ReactNode;
}) {
  return (
    <CatalogContext.Provider value={value}>
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </CatalogContext.Provider>
  );
}

export function usePendingValues(): PendingValue[] {
  return useContext(PendingContext);
}

export function useCatalog(): CatalogEntryView[] | null {
  return useContext(CatalogContext);
}
