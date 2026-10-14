"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AgentAddJobResult } from "@/models/agent.model";
import { useTranslations } from "@/i18n/client";
import { useDescriptionText } from "@/components/agent/useDescriptionText";

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

// Composed from the tool result's structured fields.
export function AddJobResult({
  output,
  input,
}: {
  output: AgentAddJobResult;
  input: Record<string, unknown>;
}) {
  const t = useTranslations("agent.results.addJob");
  const describe = useDescriptionText();
  if (output.validationError) {
    return (
      <p className="text-sm">
        {t("couldNotAdd", { error: output.displayError ?? output.validationError })}
      </p>
    );
  }

  if (output.duplicateOf) {
    return (
      <div className="text-sm">
        <p>
          {t.rich("alreadyTracked", {
            title: output.duplicateOf.title,
            company: output.duplicateOf.company,
            strong,
          })}
        </p>
        <Link
          className="text-xs underline"
          href={`/dashboard/myjobs/${output.duplicateOf.id}`}
        >
          {t("openExisting")}
        </Link>
      </div>
    );
  }

  const newEntities = output.resolutions
    .filter((r) => r.created)
    .map((r) => r.label);
  const jobTitle = typeof input.jobTitle === "string" ? input.jobTitle : t("untitled");
  const company = typeof input.company === "string" ? input.company : undefined;

  return (
    <div className="text-sm">
      <p>
        {company
          ? t.rich("addedAt", { title: jobTitle, company, strong })
          : t.rich("added", { title: jobTitle, strong })}
      </p>
      {output.jobId && (
        <Link
          className="text-xs underline"
          href={`/dashboard/myjobs/${output.jobId}`}
        >
          {t("openJob")}
        </Link>
      )}
      {newEntities.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("newEntities", { list: newEntities.join(", ") })}
        </p>
      )}
      {output.descriptionChars !== undefined && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {describe.summary(
              output.descriptionSource === "pasted",
              output.descriptionChars,
            )}
          </span>
          {output.descriptionCompleteness && (
            <Badge variant="outline">
              {describe.completeness(output.descriptionCompleteness)}
            </Badge>
          )}
        </p>
      )}
    </div>
  );
}
