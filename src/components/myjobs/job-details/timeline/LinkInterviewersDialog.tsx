"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toastActionResult } from "@/lib/toast";
import { createContact, getAllContacts } from "@/actions/contact.actions";
import { linkStageInterviewer } from "@/actions/jobStage.actions";
import type { JobStage } from "@/models/jobStage.model";
import { stageHeading, stageInitials } from "./stageDisplay";
import { useLocale, useTranslations } from "@/i18n/client";

type ContactRow = {
  id: string;
  label: string;
  title: string | null;
  company: string | null;
  value: string;
};

type LinkInterviewersDialogProps = {
  open: boolean;
  stage: JobStage | null;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
};

const EMPTY_NEW = { name: "", title: "", email: "" };

// createContact parses the whole contact form; the untouched optional fields
// arrive as "" and toContactData normalises them to null.
const contactPayload = (fields: typeof EMPTY_NEW) => ({
  ...fields,
  phone: "",
  linkedinUrl: "",
  company: "",
  location: "",
  relationship: "",
  workedAtCompany: "",
  contactRole: "",
  workedFrom: null,
  workedTo: null,
  notes: "",
  lastContactedAt: null,
});

export function LinkInterviewersDialog({
  open,
  stage,
  onOpenChange,
  onLinked,
}: LinkInterviewersDialogProps) {
  const t = useTranslations("jobs");
  const locale = useLocale();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [linkedCount, setLinkedCount] = useState(0);
  const [newContact, setNewContact] = useState(EMPTY_NEW);
  const [isPending, startTransition] = useTransition();
  const loaded = useRef(false);

  // Loaded on first open only — the job page already fires many queries.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void (async () => {
      const rows = await getAllContacts();
      if (Array.isArray(rows)) setContacts(rows);
    })();
  }, [open]);

  // Transient state only, keyed on stage?.id: a link reloads the stages and
  // hands back a new object, which would wipe the search and the draft.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLinkedCount(0);
    setNewContact(EMPTY_NEW);
  }, [open, stage?.id]);

  // Re-seeded on every reload, so a link that failed server-side corrects
  // itself rather than reading as linked until the page reloads.
  useEffect(() => {
    setLinkedIds((stage?.interviewers ?? []).map((iv) => iv.contactId));
  }, [stage]);

  if (!stage) return null;

  const term = search.trim().toLowerCase();
  const visible = term
    ? contacts.filter((c) => c.value.includes(term))
    : contacts;

  const link = (contactId: string) =>
    startTransition(async () => {
      const res = await linkStageInterviewer(stage.id, contactId);
      toastActionResult(res, {
        success: t("linkInterviewers.linked"),
        onSuccess: () => {
          setLinkedIds((prev) => [...prev, contactId]);
          setLinkedCount((n) => n + 1);
          onLinked();
        },
      });
    });

  const addAndLink = () =>
    startTransition(async () => {
      const res = await createContact(contactPayload(newContact));
      toastActionResult(res, {
        success: t("linkInterviewers.contactCreated"),
        onSuccess: () => {
          const row: ContactRow = {
            id: res.data.id,
            label: newContact.name.trim(),
            title: newContact.title.trim() || null,
            company: null,
            value: `${newContact.name} ${newContact.email}`.toLowerCase(),
          };
          setContacts((prev) => [row, ...prev]);
          setNewContact(EMPTY_NEW);
          link(row.id);
        },
      });
    });

  const doneLabel =
    linkedCount === 0
      ? t("ui.done")
      : t("linkInterviewers.doneCount", { count: linkedCount });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[720px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("linkInterviewers.title")}</DialogTitle>
          <DialogDescription>{stageHeading(stage, locale)}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("linkInterviewers.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ul className="overflow-hidden rounded-lg border">
            {visible.length === 0 && (
              <li className="px-3.5 py-4 text-[13px] text-muted-foreground">
                {t("linkInterviewers.noMatches")}
              </li>
            )}
            {visible.map((contact, index) => {
              const isLinked = linkedIds.includes(contact.id);
              const sub = [contact.title, contact.company]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={contact.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {stageInitials(contact.label)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {contact.label}
                    </span>
                    {sub && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {sub}
                      </span>
                    )}
                  </span>
                  {isLinked ? (
                    <span
                      aria-label={t("linkInterviewers.alreadyLinked", {
                        name: contact.label,
                      })}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => link(contact.id)}
                    >
                      <span className="sr-only">
                        {t("linkInterviewers.addName", { name: contact.label })}
                      </span>
                      <span aria-hidden="true">{t("ui.add")}</span>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 rounded-lg border border-dashed p-3.5">
            <p className="text-[13px] font-semibold">
              {t("linkInterviewers.newContact")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={t("linkInterviewers.fullName")}
                aria-label={t("linkInterviewers.fullName")}
                value={newContact.name}
                onChange={(e) =>
                  setNewContact((v) => ({ ...v, name: e.target.value }))
                }
              />
              <Input
                placeholder={t("linkInterviewers.roleTitle")}
                aria-label={t("linkInterviewers.roleTitle")}
                value={newContact.title}
                onChange={(e) =>
                  setNewContact((v) => ({ ...v, title: e.target.value }))
                }
              />
              <div className="col-span-2">
                <Input
                  type="email"
                  placeholder={t("linkInterviewers.email")}
                  aria-label={t("linkInterviewers.email")}
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact((v) => ({ ...v, email: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || !newContact.name.trim()}
              onClick={addAndLink}
            >
              {t("linkInterviewers.addContact")}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("ui.cancel")}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{doneLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
