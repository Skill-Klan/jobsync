import {
  getDefaultResumeId,
  getResumeById,
} from "@/actions/profile.actions";
import { notFound } from "next/navigation";
import ResumeContainer from "@/components/profile/ResumeContainer";

async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: resume }, defaultResumeId] = await Promise.all([
    getResumeById(id),
    getDefaultResumeId(),
  ]);
  // A resume that is not there (deleted, an old link) or is not the person's:
  // a 404, as for a job — not a crashed page.
  if (!resume) notFound();
  return (
    <div className="col-span-3">
      <ResumeContainer resume={resume} defaultResumeId={defaultResumeId} />
    </div>
  );
}

export default ResumePage;
