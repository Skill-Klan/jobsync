import { Metadata } from "next";

import InterviewsContainer from "@/components/interviews/InterviewsContainer";
import InterviewsTabs from "@/components/interviews/InterviewsTabs";
import { isRecordingsConfigured } from "@/skillklan/interviewRecordings";
import { getInterviewFilterOptions } from "@/actions/interview.actions";
import { getAllJobStageTypes } from "@/actions/jobStageType.actions";
import { getStatusList } from "@/actions/job.actions";
import { getTranslations } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("interviews");
  return { title: t("page.title") };
}

async function Interviews() {
  const [filters, stageTypes, statuses] = await Promise.all([
    getInterviewFilterOptions(),
    getAllJobStageTypes(),
    getStatusList(),
  ]);

  const mine = (
    <InterviewsContainer
      rounds={filters?.rounds ?? []}
      companies={filters?.companies ?? []}
      stageTypes={stageTypes ?? []}
      jobStatuses={statuses ?? []}
    />
  );
  // The recordings library — a second tab, only once Google Drive is connected
  // (src/skillklan/interviewRecordings.ts); until then the page is as before.
  return (
    <div className="col-span-3">
      {isRecordingsConfigured() ? <InterviewsTabs mine={mine} /> : mine}
    </div>
  );
}

export default Interviews;
