"use client";
import { Loader, Sparkles } from "lucide-react";
import type { AiModel } from "@/models/ai.model";
import { ResponsiveCardHeader } from "../../ResponsiveCardHeader";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { useTranslations } from "@/i18n/client";

export function StructureWithAiCard({
  aiModel,
  ollamaConnected,
  connectionError,
  isStructuring,
  onStructure,
}: {
  aiModel: AiModel;
  ollamaConnected: boolean | null;
  connectionError: string;
  isStructuring: boolean;
  onStructure: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <Card className="border-dashed">
      <ResponsiveCardHeader>
        <div>
          <p className="text-sm text-muted-foreground">
            {t("importReview.structureHint")}
          </p>
          {aiModel.provider === "ollama" &&
            ollamaConnected === false &&
            connectionError && (
              <p className="text-xs text-red-600 mt-1">
                {connectionError}
              </p>
            )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            isStructuring ||
            (aiModel.provider === "ollama" && ollamaConnected === false)
          }
          onClick={onStructure}
        >
          {isStructuring ? (
            <Loader className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {isStructuring
            ? t("importReview.structuringButton")
            : t("importReview.structureButton")}
        </Button>
      </ResponsiveCardHeader>
    </Card>
  );
}
