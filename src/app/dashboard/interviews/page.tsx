import { Metadata } from "next";

import InterviewRecordingsLibrary from "@/components/interviews/InterviewRecordingsLibrary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRecordingsConfigured } from "@/skillklan/interviewRecordings";
import { getTranslations } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("interviews");
  return { title: t("page.title") };
}

// «Співбесіди» is the interview recordings library and nothing else (owner
// 2026-10-16: no «Мої співбесіди» tab). The person's own interview stages stay
// on each job's «Етапи» tab; the old list (InterviewsContainer) is kept in the
// code, not shown. Until Google Drive is connected the page says so.
async function Interviews() {
  if (isRecordingsConfigured()) {
    return (
      <div className="col-span-3">
        <InterviewRecordingsLibrary />
      </div>
    );
  }
  const t = await getTranslations("interviews");
  return (
    <div className="col-span-3">
      <Card>
        <CardHeader>
          <CardTitle>{t("recordings.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">{t("recordings.notConnected")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Interviews;
