import { notFound } from "next/navigation";
import StudentPlansAdmin from "@/components/plans/StudentPlansAdmin";
import { listPlanStudents } from "@/actions/plan.actions";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { isAdminSession } from "@/skillklan/cabinetAdmin";

// The admin's page: not there while `plans` is off, and not there for a
// student — a 404, as for any page that does not exist for them.
async function StudentPlans() {
  if (!(await getFeatureFlags()).plans) notFound();
  if (!(await isAdminSession())) notFound();
  const result = await listPlanStudents();
  if (!result.success) notFound();
  return (
    <div className="col-span-3">
      <StudentPlansAdmin students={result.data.students} tracks={result.data.tracks} />
    </div>
  );
}

export default StudentPlans;
