import QuestionsPageClient from "./QuestionsPageClient";
import { getTagsWithQuestionCounts } from "@/actions/question.actions";
import { getAllTags } from "@/actions/tag.actions";
import React from "react";
import { notFound } from "next/navigation";
import { getFeatureFlags } from "@/skillklan/featureFlags";

async function Questions({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  // Switched off in Settings → «Функції»: the page is not there for anyone.
  if (!(await getFeatureFlags()).questions) notFound();
  const { stage } = await searchParams;
  const [allTags, tagsWithCounts] = await Promise.all([
    getAllTags(),
    getTagsWithQuestionCounts(stage),
  ]);

  return (
    <QuestionsPageClient
      allTags={allTags || []}
      tagsWithCounts={tagsWithCounts?.data || []}
      totalQuestions={tagsWithCounts?.totalQuestions || 0}
    />
  );
}

export default Questions;
