import TasksPageClient from "./TasksPageClient";
import { getAllActivityTypes } from "@/actions/activity.actions";
import { getActivityTypesWithTaskCounts } from "@/actions/task.actions";
import React from "react";
import { notFound } from "next/navigation";
import { getFeatureFlags } from "@/skillklan/featureFlags";

// Switched off in Settings → «Функції» — the page is not there for anyone,
// the admin included; the tasks stay in the database.
async function Tasks() {
  if (!(await getFeatureFlags()).tasks) notFound();
  const [activityTypes, activityTypesWithCounts] = await Promise.all([
    getAllActivityTypes(),
    getActivityTypesWithTaskCounts(),
  ]);

  return (
    <TasksPageClient
      activityTypes={activityTypes || []}
      activityTypesWithCounts={activityTypesWithCounts?.data || []}
      totalTasks={activityTypesWithCounts?.totalTasks || 0}
    />
  );
}

export default Tasks;
