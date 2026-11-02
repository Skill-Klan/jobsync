"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ExternalLink, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { setPlanItemDone, setPlanItemNote, type PlanView as PlanData } from "@/actions/plan.actions";
import { useTranslations } from "@/i18n/client";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_NOTE_MAX, progressOf, type PlanItemView } from "@/skillklan/plans/tree";

// «Навчальний план»: the student's own copy of a course plan — a tab per module
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

type Edit = (id: string, change: (item: PlanItemView) => PlanItemView) => void;

export default function PlanView({ plans }: { plans: PlanData[] }) {
  const t = useTranslations("plans");
  const [state, setState] = useState(plans);
  const edit: Edit = (id, change) =>
    setState((prev) => prev.map((plan) => ({ ...plan, modules: patchTree(plan.modules, id, change) })));

  if (state.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{t("student.empty")}</p>;
  }
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("student.title")}</h1>
      {state.map((plan) => (
        <PlanSection key={plan.id} plan={plan} edit={edit} />
      ))}
    </div>
  );
}

function PlanSection({ plan, edit }: { plan: PlanData; edit: Edit }) {
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
            <h3 className="font-medium">{module.title}</h3>
            {module.children.map((topic) => (
              <Topic key={topic.id} topic={topic} edit={edit} />
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

function Topic({ topic, edit }: { topic: PlanItemView; edit: Edit }) {
  const t = useTranslations("plans");
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <span className="font-medium">{topic.title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <Counter item={topic} />
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </CollapsibleTrigger>
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
                <h4 className="text-sm font-medium">{child.title}</h4>
                {child.children.map((point) => (
                  <Point key={point.id} item={point} edit={edit} />
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
                  <Point key={task.id} item={task} edit={edit} />
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
          return <Point key={child.id} item={child} edit={edit} />;
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Point({ item, edit }: { item: PlanItemView; edit: Edit }) {
  const t = useTranslations("plans");
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");

  const tick = (done: boolean) => {
    const before = item.done;
    edit(item.id, (i) => ({ ...i, done }));
    startTransition(async () => {
      const result = await setPlanItemDone(item.id, done).catch(() => null);
      if (!result?.success) {
        edit(item.id, (i) => ({ ...i, done: before }));
        toastError(result?.message);
      }
    });
  };

  const saveNote = () => {
    startTransition(async () => {
      const result = await setPlanItemNote(item.id, draft).catch(() => null);
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
