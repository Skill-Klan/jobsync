"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "@/i18n/client";
import InterviewRecordingsLibrary from "./InterviewRecordingsLibrary";

// «Співбесіди»: the person's own interviews and the recordings library
// (owner 2026-10-16: a tab here, not a new menu item). The page renders this
// only when the library is connected; the chosen tab is in the address.
export default function InterviewsTabs({ mine }: { mine: React.ReactNode }) {
  const t = useTranslations("interviews");
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const tab = query.get("tab") === "recordings" ? "recordings" : "mine";

  const onTabChange = (next: string) => {
    const params = new URLSearchParams(query.toString());
    if (next === "mine") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="mine">{t("tabs.mine")}</TabsTrigger>
        <TabsTrigger value="recordings">{t("tabs.recordings")}</TabsTrigger>
      </TabsList>
      <TabsContent value="mine">{mine}</TabsContent>
      {/* Radix renders only the open tab — the library is not read until then. */}
      <TabsContent value="recordings">
        <InterviewRecordingsLibrary />
      </TabsContent>
    </Tabs>
  );
}
