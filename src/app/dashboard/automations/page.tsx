import { notFound } from "next/navigation";
import { getResumeList } from "@/actions/profile.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import { AutomationContainer } from "@/components/automations/AutomationContainer";
import { getFeatureFlags } from "@/skillklan/featureFlags";

// Switched off in Settings → «Функції» — the page is not there for anyone,
// the admin included; the automations and what they found stay in the database.
export default async function AutomationsPage() {
  if (!(await getFeatureFlags()).automations) notFound();
  const resumeResult = await getResumeList(1, APP_CONSTANTS.RESUME_PICKER_LIMIT);
  const resumes =
    resumeResult?.data?.map(
      (r: { id: string; title: string; _count?: { ResumeSections?: number } }) => ({
        id: r.id,
        title: r.title,
        sectionCount: r._count?.ResumeSections ?? 0,
      }),
    ) || [];

  return (
    <div className="col-span-3">
      <AutomationContainer resumes={resumes} />
    </div>
  );
}
