import { notFound } from "next/navigation";
import StudentPlansAdmin from "@/components/plans/StudentPlansAdmin";
import { listPlanStudents } from "@/actions/plan.actions";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { isAdminSession } from "@/skillklan/cabinetAdmin";
import { loadMentors, viewerCabinetId } from "@/skillklan/mentorPlans";

// The admin's page: not there while `plans` is off, and not there for a
// student — a 404, as for any page that does not exist for them.
async function StudentPlans() {
  if (!(await getFeatureFlags()).plans) notFound();
  if (!(await isAdminSession())) notFound();
  const [result, viewer] = await Promise.all([listPlanStudents(), viewerCabinetId()]);
  if (!result.success) notFound();
  // The mentors for the filter: the backend's list, shared for 30 s with the
  // «Навчальний план» page; a viewer without a cabinet id has none to ask.
  const mentors = viewer === null ? undefined : await loadMentors(viewer);
  return (
    <div className="col-span-3">
      <StudentPlansAdmin students={result.data.students} tracks={result.data.tracks} mentors={mentors} />
    </div>
  );
}

export default StudentPlans;
