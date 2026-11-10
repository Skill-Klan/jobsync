import { notFound } from "next/navigation";
import PlanView from "@/components/plans/PlanView";
import MentorPlans from "@/components/plans/MentorPlans";
import { getMyPlans } from "@/actions/plan.actions";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { isAdminSession } from "@/skillklan/cabinetAdmin";
import { loadMentorLookup, viewerCabinetId } from "@/skillklan/mentorPlans";
import { getTranslations } from "@/i18n/server";

// Switched off in Settings → «Функції» — the page is not there for anyone,
// the admin included; the plans and ticks stay in the database.
//
// A student sees their own plan. The admin and the QA moderator also pick a
// mentor and look at their students' plans; a mentor (D98) sees their own
// students. Who is a mentor, and whose students, is the backend's answer.
async function Plan() {
  if (!(await getFeatureFlags()).plans) notFound();
  const [result, canPick, viewer] = await Promise.all([getMyPlans(), isAdminSession(), viewerCabinetId()]);
  const own = result.success ? result.data : [];
  const lookup = viewer === null ? null : await loadMentorLookup(viewer, canPick);
  const looksAtOthers = lookup !== null && (lookup.canPick || lookup.me !== null);
  if (!looksAtOthers) {
    return (
      <div className="col-span-3">
        <PlanView plans={own} />
      </div>
    );
  }
  const t = await getTranslations("plans");
  return (
    <div className="col-span-3 space-y-10">
      <MentorPlans mentors={lookup.mentors} me={lookup.me} canPick={lookup.canPick} />
      {own.length > 0 && <PlanView plans={own} title={t("mentor.myPlan")} />}
    </div>
  );
}

export default Plan;
