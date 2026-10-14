import { Metadata } from "next";

import InterviewsContainer from "@/components/interviews/InterviewsContainer";
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

  return (
    <div className="col-span-3">
      <InterviewsContainer
        rounds={filters?.rounds ?? []}
        companies={filters?.companies ?? []}
        stageTypes={stageTypes ?? []}
        jobStatuses={statuses ?? []}
      />
    </div>
  );
}

export default Interviews;
