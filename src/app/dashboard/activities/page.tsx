import { notFound } from "next/navigation";
import ActivitiesContainer from "@/components/activities/ActivitiesContainer";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import React from "react";

// Switched off in Settings → «Функції» — the page is not there for anyone,
// the admin included; the records stay in the database.
async function Activities() {
  if (!(await getFeatureFlags()).activities) notFound();
  return (
    <div className="col-span-3">
      <ActivitiesContainer />
    </div>
  );
}

export default Activities;
