import { notFound } from "next/navigation";
import { AutomationDetailContainer } from "@/components/automations/AutomationDetailContainer";
import { getFeatureFlags } from "@/skillklan/featureFlags";

async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Off in Settings → «Функції»: not there for anyone (see the list page).
  if (!(await getFeatureFlags()).automations) notFound();
  const { id } = await params;

  return (
    <div className="col-span-3">
      <AutomationDetailContainer automationId={id} />
    </div>
  );
}

export default AutomationDetailPage;
