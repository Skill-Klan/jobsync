"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NoteFormSchema } from "@/models/note.schema";
import { NoteResponse } from "@/models/note.model";
import { addNote, updateNote } from "@/actions/note.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import { useEffect, useTransition } from "react";
import { Loader } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import TiptapEditor from "../TiptapEditor";
import { useTranslations } from "@/i18n/client";

type NoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  editNote?: NoteResponse | null;
  onSaved: () => void;
};

export function NoteDialog({
  open,
  onOpenChange,
  jobId,
  editNote,
  onSaved,
}: NoteDialogProps) {
  const t = useTranslations("jobs");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof NoteFormSchema>>({
    resolver: zodResolver(NoteFormSchema) as any,
    defaultValues: {
      jobId,
      content: "",
    },
  });

  useEffect(() => {
    if (editNote) {
      form.reset({ id: editNote.id, jobId, content: editNote.content });
    } else {
      form.reset({ jobId, content: "" });
    }
  }, [editNote, jobId, form, open]);

  function onSubmit(data: z.infer<typeof NoteFormSchema>) {
    startTransition(async () => {
      const result = editNote
        ? await updateNote(data)
        : await addNote(data);

      if (result.success) {
        toastSuccess(editNote ? t("notes.updated") : t("notes.added"));
        form.reset({ jobId, content: "" });
        onOpenChange(false);
        onSaved();
      } else {
        toastError(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editNote ? t("notes.editTitle") : t("notes.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {editNote
              ? t("notes.editDescription")
              : t("notes.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <TiptapEditor field={field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("ui.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {t("ui.save")}
                {isPending && (
                  <Loader className="ml-2 h-4 w-4 shrink-0 spinner" />
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
