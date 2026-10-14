"use client";
import { Question } from "@/models/question.model";
import { QuestionCard } from "./QuestionCard";
import { useTranslations } from "@/i18n/client";

type QuestionListProps = {
  questions: Question[];
  onEdit: (question: Question) => void;
  onDelete: (questionId: string) => void;
};

export function QuestionList({ questions, onEdit, onDelete }: QuestionListProps) {
  const t = useTranslations("questions");
  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("list.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
