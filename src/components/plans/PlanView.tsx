"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ExternalLink, StickyNote } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { setPlanItemDone, setPlanItemNote, setPlanSectionDone, type PlanView as PlanData } from "@/actions/plan.actions";

// Where a tick or a note goes: the student's own actions by default; a mentor
// (or the admin) looking at a student's plan passes actions bound to that student.
export type PlanWriter = {
  done: (itemId: string, done: boolean) => ReturnType<typeof setPlanItemDone>;
  note: (itemId: string, note: string) => ReturnType<typeof setPlanItemNote>;
  // A whole topic or group at once (SKD-73).
  section: (sectionId: string, done: boolean) => ReturnType<typeof setPlanSectionDone>;
};
const OWN_WRITER: PlanWriter = { done: setPlanItemDone, note: setPlanItemNote, section: setPlanSectionDone };
import { useTranslations } from "@/i18n/client";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TICKABLE_KINDS } from "@/skillklan/plans/kinds";
import { PLAN_NOTE_MAX, progressOf, type PlanItemView } from "@/skillklan/plans/tree";

// «Навчальний план»: a student's copy of a course plan — a tab per module
// with its percent, topics that open, a tick and a note on every point and
// homework task. The progress is counted here from the ticks, never stored.

function patchTree(items: PlanItemView[], id: string, change: (item: PlanItemView) => PlanItemView): PlanItemView[] {
  return items.map((item) =>
    item.id === id ? change(item) : { ...item, children: patchTree(item.children, id, change) },
  );
}

// "Модуль 1. Основи тестування …" → "Модуль 1": the tab, not the whole heading.
function shortModuleTitle(title: string): string {
  const head = title.split(/[.:]/)[0].trim();
  return head === "" ? title : head;
}

// Every point and task under `item` set to `done`; the rest of the tree as it was.
function withSubtreeDone(item: PlanItemView, done: boolean): PlanItemView {
  return {
    ...item,
    done: TICKABLE_KINDS.includes(item.kind) ? done : item.done,
    children: item.children.map((child) => withSubtreeDone(child, done)),
  };
}

type Edit = (id: string, change: (item: PlanItemView) => PlanItemView) => void;

export default function PlanView({ plans, writer = OWN_WRITER, title }: { plans: PlanData[]; writer?: PlanWriter; title?: string }) {
  const t = useTranslations("plans");
  const [state, setState] = useState(plans);
  const edit: Edit = (id, change) =>
    setState((prev) => prev.map((plan) => ({ ...plan, modules: patchTree(plan.modules, id, change) })));

  if (state.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{t("student.empty")}</p>;
  }
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{title ?? t("student.title")}</h1>
      {state.map((plan) => (
        <PlanSection key={plan.id} plan={plan} edit={edit} writer={writer} />
      ))}
    </div>
  );
}

function PlanSection({ plan, edit, writer }: { plan: PlanData; edit: Edit; writer: PlanWriter }) {
  const t = useTranslations("plans");
  const overall = progressOf({ kind: "module", done: false, children: plan.modules });
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">{plan.title}</h2>
          <span className="text-sm text-muted-foreground">
            {t("student.overall", { done: overall.done, total: overall.total, percent: overall.percent })}
          </span>
        </div>
        <Progress value={overall.percent} className="h-2" />
      </div>
      <Tabs defaultValue={plan.modules[0]?.id}>
        <TabsList className="h-auto flex-wrap justify-start">
          {plan.modules.map((module) => (
            <TabsTrigger key={module.id} value={module.id} className="gap-2">
              {shortModuleTitle(module.title)}
              <span className="text-xs text-muted-foreground">{progressOf(module).percent}%</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {plan.modules.map((module) => (
          <TabsContent key={module.id} value={module.id} className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <SectionTick section={module} edit={edit} writer={writer} />
              <h3 className="font-medium">{module.title}</h3>
            </div>
            {module.children.map((topic) => (
              <Topic key={topic.id} topic={topic} edit={edit} writer={writer} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function Counter({ item }: { item: PlanItemView }) {
  const { done, total } = progressOf(item);
  return <span className="text-sm text-muted-foreground">{`${done}/${total}`}</span>;
}

// SKD-73: a checkbox in the heading of a module, a topic or a group that ticks every point
// under it — or unticks them all when they are all done. It asks first: one
// click changes many points. Ticked = all done, half-ticked = some.
function SectionTick({ section, edit, writer }: { section: PlanItemView; edit: Edit; writer: PlanWriter }) {
  const t = useTranslations("plans");
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const { done, total } = progressOf(section);
  const all = total > 0 && done === total;
  useEffect(() => {
    if (box.current) box.current.indeterminate = done > 0 && done < total;
  }, [done, total]);
  if (total === 0) return null;

  // All done → the click takes the ticks off; otherwise it ticks what is left.
  const target = !all;
  const confirm = () => {
    startTransition(async () => {
      const result = await writer.section(section.id, target).catch(() => null);
      if (result?.success) {
        edit(section.id, (i) => withSubtreeDone(i, target));
      } else {
        toastError(result?.message);
      }
    });
  };

  return (
    <>
      <input
        ref={box}
        type="checkbox"
        checked={all}
        onChange={() => setAsking(true)}
        aria-label={t("student.sectionTickLabel", { title: section.title })}
        className="h-4 w-4 shrink-0 accent-primary"
      />
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(target ? "student.sectionTickTitle" : "student.sectionUntickTitle", { title: section.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target
                ? t("student.sectionTickDescription", { count: total - done })
                : t("student.sectionUntickDescription", { count: done })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("student.noteCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>{t("student.sectionConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Topic({ topic, edit, writer }: { topic: PlanItemView; edit: Edit; writer: PlanWriter }) {
  const t = useTranslations("plans");
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <SectionTick section={topic} edit={edit} writer={writer} />
        <CollapsibleTrigger className="flex flex-1 items-center justify-between gap-3 text-left">
          <span className="font-medium">{topic.title}</span>
          <span className="flex shrink-0 items-center gap-2">
            <Counter item={topic} />
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-4 border-t p-3">
        {topic.materialUrl && (
          <a
            href={topic.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("student.material")}
          </a>
        )}
        {topic.children.map((child) => {
          if (child.kind === "group") {
            return (
              <div key={child.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <SectionTick section={child} edit={edit} writer={writer} />
                  <h4 className="text-sm font-medium">{child.title}</h4>
                </div>
                {child.children.map((point) => (
                  <Point key={point.id} item={point} edit={edit} writer={writer} />
                ))}
              </div>
            );
          }
          if (child.kind === "homework") {
            return (
              <div key={child.id} className="space-y-1 rounded-md bg-muted/50 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-medium">{child.title}</h4>
                  <Counter item={child} />
                </div>
                {child.children.map((task) => (
                  <Point key={task.id} item={task} edit={edit} writer={writer} />
                ))}
              </div>
            );
          }
          if (child.kind === "homework_ref") {
            return (
              <p key={child.id} className="text-sm text-muted-foreground">
                {child.title}
              </p>
            );
          }
          return <Point key={child.id} item={child} edit={edit} writer={writer} />;
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// A student, or a mentor / the admin / the QA moderator working in a student's
// plan, ticks and annotates the same fields; no author is kept.
function Point({ item, edit, writer }: { item: PlanItemView; edit: Edit; writer: PlanWriter }) {
  const t = useTranslations("plans");
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");

  const tick = (done: boolean) => {
    const before = item.done;
    edit(item.id, (i) => ({ ...i, done }));
    startTransition(async () => {
      const result = await writer.done(item.id, done).catch(() => null);
      if (!result?.success) {
        edit(item.id, (i) => ({ ...i, done: before }));
        toastError(result?.message);
      }
    });
  };

  const saveNote = () => {
    startTransition(async () => {
      const result = await writer.note(item.id, draft).catch(() => null);
      if (result?.success) {
        const note = draft.trim() === "" ? null : draft.trim();
        edit(item.id, (i) => ({ ...i, note }));
        setDraft(note ?? "");
        setEditing(false);
        toastSuccess(t("student.noteSaved"));
      } else {
        toastError(result?.message);
      }
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={item.done}
          onChange={(e) => tick(e.target.checked)}
          aria-label={t("student.tickLabel", { title: item.title })}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span className={cn("flex-1 whitespace-pre-line text-sm", item.done && "text-muted-foreground line-through")}>
          {item.title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 shrink-0", item.note ? "text-primary" : "text-muted-foreground")}
          aria-label={item.note ? t("student.noteEdit") : t("student.noteAdd")}
          onClick={() => setEditing((v) => !v)}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </div>
      {item.note && !editing && (
        <p className="ml-6 whitespace-pre-line rounded bg-muted px-2 py-1 text-sm">{item.note}</p>
      )}
      {editing && (
        <div className="ml-6 space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={PLAN_NOTE_MAX}
            placeholder={t("student.notePlaceholder")}
            aria-label={t("student.noteLabel", { title: item.title })}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={saveNote}>
              {t("student.noteSave")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(item.note ?? "");
                setEditing(false);
              }}
            >
              {t("student.noteCancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
