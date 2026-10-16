"use client";

import { createContext, useContext } from "react";
import { ALL_FEATURES_ON, type FeatureFlags } from "@/skillklan/features";

// The SkillKlan feature switches for the browser (src/skillklan/features.ts).
// The dashboard layout reads them on the server and provides them here, so
// the menu, the dashboard and Tasks hide the same parts the server does.
const FeaturesContext = createContext<FeatureFlags>(ALL_FEATURES_ON);

export function FeaturesProvider({
  value,
  children,
}: {
  value: FeatureFlags;
  children: React.ReactNode;
}) {
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures(): FeatureFlags {
  return useContext(FeaturesContext);
}
