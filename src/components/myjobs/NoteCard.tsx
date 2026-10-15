"use client";
import { NoteResponse } from "@/models/note.model";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { Button } from "../ui/button";
import { Pencil, Trash } from "lucide-react";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { JOB_DATE_TIME } from "./useJobTypeLabels";

type NoteCardProps = {
  note: NoteResponse;
  onEdit: (note: NoteResponse) => void;
  onDelete: (noteId: string) => void;
};

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const t = useTranslations("jobs");
  const formatDate = useFormatDate();
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {formatDate(new Date(note.createdAt), JOB_DATE_TIME)}
          {note.isEdited && (
            <span className="ml-2 text-xs text-muted-foreground">
              {t("notes.edited")}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(note)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(note.id)}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <TipTapContentViewer content={note.content} />
    </div>
  );
}
