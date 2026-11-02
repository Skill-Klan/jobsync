import { notFound } from "next/navigation";
import PlanView from "@/components/plans/PlanView";
import { getMyPlans } from "@/actions/plan.actions";
import { getFeatureFlags } from "@/skillklan/featureFlags";

// Switched off in Settings → «Функції» — the page is not there for anyone,
// the admin included; the plans and ticks stay in the database.
async function Plan() {
  if (!(await getFeatureFlags()).plans) notFound();
  const result = await getMyPlans();
  return (
    <div className="col-span-3">
      <PlanView plans={result.success ? result.data : []} />
    </div>
  );
}

export default Plan;
