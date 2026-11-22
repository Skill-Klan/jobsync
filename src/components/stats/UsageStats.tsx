import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DATE_PATTERNS } from "@/i18n/dates";
import { getFormatDate, getTranslations } from "@/i18n/server";
import type { UsageRow, UsageSummary } from "@/skillklan/usageStats";
import UsageTable from "./UsageTable";
import type { TableRow } from "./usageSort";

// «Статистика»: the numbers on top, the people below, the longest quiet first.
export default async function UsageStats({ summary, people }: { summary: UsageSummary; people: UsageRow[] }) {
  const t = await getTranslations("stats");
  const formatDate = await getFormatDate();
  const rows: TableRow[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    lastSignIn: p.lastLoginAt?.getTime() ?? null,
    lastSignInLabel: p.lastLoginAt ? formatDate(p.lastLoginAt, DATE_PATTERNS.dateNumeric) : null,
    jobs: p.jobs,
    resumes: p.resumes,
    resumesWithFile: p.resumesWithFile,
    modulesClosed: p.modulesClosed,
    modulesTotal: p.modulesTotal,
  }));
  const signIn: { key: "people" | "signedIn" | "neverSignedIn" | "active7" | "active30"; value: number }[] = [
    { key: "people", value: summary.people },
    { key: "signedIn", value: summary.signedIn },
    { key: "neverSignedIn", value: summary.neverSignedIn },
    { key: "active7", value: summary.active7 },
    { key: "active30", value: summary.active30 },
  ];
  const use: { key: "withJobs" | "withResume" | "withResumeFile" | "withClosedModule"; value: number }[] = [
    { key: "withJobs", value: summary.withJobs },
    { key: "withResume", value: summary.withResume },
    { key: "withResumeFile", value: summary.withResumeFile },
    { key: "withClosedModule", value: summary.withClosedModule },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription className="max-w-3xl">{t("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {signIn.map(({ key, value }) => (
              <div key={key} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t(key)}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">{t("signInNote")}</p>
          <div>
            <h3 className="text-sm font-medium">{t("useTitle")}</h3>
            <p className="mb-2 text-xs text-muted-foreground">{t("useHint")}</p>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {use.map(({ key, value }) => (
                <div key={key} className="flex items-baseline justify-between gap-3 rounded-lg border px-3 py-2">
                  <dt className="text-sm">{t(key)}</dt>
                  <dd className="whitespace-nowrap tabular-nums font-medium">{t("outOf", { count: value, total: summary.people })}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{t("medianJobs", { count: summary.medianJobs })}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          <CardDescription>{t("listHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <UsageTable rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
