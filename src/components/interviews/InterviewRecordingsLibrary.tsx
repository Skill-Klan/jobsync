"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Folder, Play, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveCardHeader } from "../ResponsiveCardHeader";
import Loading from "../Loading";
import { RecordsCount } from "../RecordsCount";
import { SearchInput } from "../SearchInput";
import { useTranslations } from "@/i18n/client";
import { cn } from "@/lib/utils";
import {
  DIRECTIONS,
  directionOf,
  STAGES,
  companyNames,
  companyOptions,
  directionCounts,
  filterRecordings,
  filtersToParams,
  groupByCompany,
  hasCyrillic,
  hasFilters,
  parseFilters,
  stageCounts,
  type CompanyGroup,
  type CompanyOption,
  type Filters,
  type LibraryRecording,
} from "@/skillklan/recordingsLibrary";

// The interview recordings library (owner 2026-10-16): every reviewed
// recording, for everyone to listen to — and only to listen: no download
// button, no "Download" in the player's own menu, no "Save audio as" on right
// click. The files stay in Google Drive; the player streams them through this
// server (api/skillklan/interview-recordings), so seeking works and nothing of
// Google's reaches the browser.
//
// Finding one (owner 2026-10-18): filters — direction, stage, company, search;
// first the folders of the companies, the recordings inside by stage; the
// filters are kept in the page address (recordingsLibrary.ts).

const API = "/api/skillklan/interview-recordings";

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const toggled = <T,>(items: readonly T[], item: T) =>
  items.includes(item) ? items.filter((i) => i !== item) : [...items, item];

export default function InterviewRecordingsLibrary() {
  const t = useTranslations("interviews");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() =>
    parseFilters(new URLSearchParams(searchParams?.toString() ?? "")),
  );
  const [recordings, setRecordings] = useState<LibraryRecording[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [unplayable, setUnplayable] = useState<string | null>(null);
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    let alive = true;
    fetch(API, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { recordings: LibraryRecording[] };
        if (alive) setRecordings(body.recordings);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // The address follows the filters — a link to this page opens the same
  // selection. replaceState: no new history entry per keystroke, no request
  // to the server.
  useEffect(() => {
    const query = filtersToParams(filters).toString();
    const url = `${pathname ?? window.location.pathname}${query ? `?${query}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [filters, pathname]);

  const all = useMemo(() => recordings ?? [], [recordings]);
  const shown = useMemo(() => filterRecordings(all, filters), [all, filters]);
  const names = useMemo(() => companyNames(all), [all]);
  const groups = useMemo(() => groupByCompany(shown, filters.sort, names), [shown, filters.sort, names]);
  const stagesCount = useMemo(() => stageCounts(all, filters), [all, filters]);
  const directionsCount = useMemo(() => directionCounts(all, filters), [all, filters]);
  const companies = useMemo(() => companyOptions(all, filters), [all, filters]);
  const filtered = hasFilters(filters);

  // A single company left (picked, or the only one the search finds) opens by
  // itself; a click still closes it.
  const isOpen = (key: string) => (groups.length === 1) !== filters.open.includes(key);
  const companyName = (name: string | null) => name ?? t("recordings.noCompany");

  const row = (r: LibraryRecording, inCompany: CompanyGroup | null) => (
    <RecordingRow
      key={r.id}
      recording={r}
      showCompany={!inCompany}
      // The list: the full kind. A company's folder: the stage is its heading, so only
      // the direction — and only when the company has both.
      badge={
        !inCompany
          ? t(`recordings.kinds.${r.kind}`)
          : inCompany.directions.length > 1
            ? t(`recordings.directions.${directionOf(r.kind)}`)
            : null
      }
      playing={playingId === r.id}
      unplayable={unplayable === r.id}
      onToggle={() => {
        setUnplayable(null);
        setPlayingId(playingId === r.id ? null : r.id);
      }}
      onError={() => setUnplayable(r.id)}
    />
  );

  return (
    <Card>
      <ResponsiveCardHeader>
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <CardTitle>{t("recordings.title")}</CardTitle>
            {all.length > 0 && (
              <>
                <RecordsCount count={shown.length} total={all.length} label={t("recordings.recordsLabel")} />
                <span className="text-xs text-muted-foreground">
                  · {t("recordings.companiesCount", { count: groups.length })}
                </span>
              </>
            )}
          </div>
          <CardDescription>{t("recordings.description")}</CardDescription>
        </div>
      </ResponsiveCardHeader>
      <CardContent className="space-y-4">
        {all.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={t("recordings.direction")} className="flex gap-1">
                <Toggle on={!filters.direction} onClick={() => update({ direction: null })}>
                  {t("recordings.directions.all")}
                </Toggle>
                {DIRECTIONS.map((d) => (
                  <Toggle key={d} on={filters.direction === d} onClick={() => update({ direction: d })}>
                    {t(`recordings.directions.${d}`)}
                    {" "}
                    <Count n={directionsCount[d]} />
                  </Toggle>
                ))}
              </div>
              <div role="group" aria-label={t("recordings.stageFilter")} className="flex flex-wrap gap-1">
                {STAGES.map((s) => (
                  <Toggle
                    key={s}
                    on={filters.stages.includes(s)}
                    onClick={() => update({ stages: toggled(filters.stages, s) })}
                  >
                    {t(`recordings.stages.${s}`)}
                    {" "}
                    <Count n={stagesCount[s]} />
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompanyPicker
                options={companies}
                value={filters.company}
                selectedName={companies.find((c) => c.key === filters.company)?.name ?? null}
                onChange={(key) => update({ company: key })}
              />
              <SearchInput
                value={filters.query}
                onChange={(query) => update({ query })}
                placeholder={t("recordings.searchPlaceholder")}
              />
              {filtered && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => update({ direction: null, stages: [], company: null, query: "" })}
                >
                  {t("recordings.reset")}
                </Button>
              )}
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {filters.view === "companies" && (
                  <div role="group" aria-label={t("recordings.sort")} className="flex gap-1">
                    {(["count", "name"] as const).map((s) => (
                      <Toggle key={s} on={filters.sort === s} onClick={() => update({ sort: s })}>
                        {t(`recordings.sorts.${s}`)}
                      </Toggle>
                    ))}
                  </div>
                )}
                <div role="group" aria-label={t("recordings.view")} className="flex gap-1">
                  {(["companies", "all"] as const).map((v) => (
                    <Toggle key={v} on={filters.view === v} onClick={() => update({ view: v })}>
                      {t(`recordings.views.${v}`)}
                    </Toggle>
                  ))}
                </div>
              </div>
            </div>
            {/* Typed in Ukrainian: the company or the name may be in Latin letters — even when
                something was found (a person), the company they look for may not be. */}
            {/* The live region is always there (text only when needed): one mounted together
                with its text is not announced by screen readers. */}
            <p
              role="status"
              className={cn("text-xs text-muted-foreground", !hasCyrillic(filters.query) && "sr-only")}
            >
              {hasCyrillic(filters.query) ? t("recordings.searchInEnglish") : ""}
            </p>
          </div>
        )}
        {failed ? (
          <p role="alert" className="py-10 text-center text-sm text-destructive">
            {t("recordings.failed")}
          </p>
        ) : recordings === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filtered ? t("recordings.emptyFiltered") : t("recordings.empty")}
          </p>
        ) : filters.view === "all" ? (
          <ul className="divide-y">{shown.map((r) => row(r, null))}</ul>
        ) : (
          <div className="divide-y border-t">
            {groups.map((g) => {
              const open = isOpen(g.key);
              const bodyId = `company-${g.key || "none"}`;
              return (
                <section key={g.key} aria-label={companyName(g.name)}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => update({ open: toggled(filters.open, g.key) })}
                    className="flex w-full items-start gap-2 py-3 text-left"
                  >
                    {open ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {/* The name keeps its room; on a narrow screen the stages go below it. */}
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex min-w-0 grow basis-40 items-baseline gap-2">
                        <span className="truncate font-medium">{companyName(g.name)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{g.total}</span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {STAGES.filter((s) => g.counts[s] > 0).map((s) => (
                          <Badge key={s} variant="secondary" className="font-normal">
                            {t(`recordings.stages.${s}`)} {g.counts[s]}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div id={bodyId} className="space-y-3 pb-3 pl-6">
                      {g.stages.map((s) => (
                        <div key={s.stage}>
                          <h4 className="text-xs font-medium text-muted-foreground">
                            {t(`recordings.stages.${s.stage}`)} ·{" "}
                            {s.recordings.length + s.folders.reduce((n, f) => n + f.recordings.length, 0)}
                          </h4>
                          {s.recordings.length > 0 && (
                            <ul className="divide-y">{s.recordings.map((r) => row(r, g))}</ul>
                          )}
                          {s.folders.map((f) => (
                            <div key={f.name} className="mt-1 pl-4">
                              <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                                <Folder className="h-3.5 w-3.5" aria-hidden />
                                <span className="truncate">{f.name}</span>
                              </div>
                              <ul className="divide-y">{f.recordings.map((r) => row(r, g))}</ul>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={on ? "secondary" : "outline"} aria-pressed={on} onClick={onClick}>
      {children}
    </Button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs tabular-nums text-muted-foreground">{n}</span>;
}

function CompanyPicker({
  options,
  value,
  selectedName,
  onChange,
}: {
  options: CompanyOption[];
  value: string | null;
  selectedName: string | null;
  onChange: (key: string | null) => void;
}) {
  const t = useTranslations("interviews");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Closing by a pick does not go through onOpenChange — clear the search here too,
  // or the list opens next time filtered by the old query, «All companies» hidden.
  const pick = (key: string | null) => {
    onChange(key);
    setOpen(false);
    setSearch("");
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t("recordings.company")}
          className="w-[220px] justify-between font-normal"
        >
          <span className="truncate">
            {value ? (selectedName ?? t("recordings.noCompany")) : t("recordings.allCompanies")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("recordings.companySearch")} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {hasCyrillic(search) ? t("recordings.companyInEnglish") : t("recordings.companyNotFound")}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value={`__all ${t("recordings.allCompanies")}`} onSelect={() => pick(null)}>
                <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} aria-hidden />
                {t("recordings.allCompanies")}
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o.key} value={`${o.name ?? ""} ${o.key}`} onSelect={() => pick(o.key)}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.key ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="flex-1 truncate">{o.name ?? t("recordings.noCompany")}</span>
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">{o.count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RecordingRow({
  recording: r,
  showCompany,
  badge,
  playing,
  unplayable,
  onToggle,
  onError,
}: {
  recording: LibraryRecording;
  showCompany: boolean;
  badge: string | null;
  playing: boolean;
  unplayable: boolean;
  onToggle: () => void;
  onError: () => void;
}) {
  const t = useTranslations("interviews");
  const Player = r.mimeType.startsWith("video/") ? "video" : "audio";
  // Who and what: the bot's name gives the person; the archive's names are
  // shown as they are.
  const who = r.person ?? r.title;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-24">
          {r.date ? displayDate(r.date) : t("recordings.noDate")}
        </span>
        {badge && <Badge variant="secondary">{badge}</Badge>}
        {r.specializations.length > 0 && <Badge variant="outline">{r.specializations.join(" + ")}</Badge>}
        {/* A phone: the date, kind and the button on top, the name below in full. */}
        <span className="order-last min-w-0 basis-full break-words text-sm sm:order-none sm:basis-auto sm:flex-1 sm:truncate">
          {showCompany && r.company ? (
            <>
              <span className="font-medium">{r.company}</span>
              {" · "}
              {who}
            </>
          ) : (
            who
          )}
        </span>
        <div className="ml-auto flex shrink-0 gap-1 sm:ml-0">
          <Button type="button" size="sm" variant={playing ? "secondary" : "outline"} onClick={onToggle}>
            {playing ? <X className="h-3.5 w-3.5 sm:mr-1" /> : <Play className="h-3.5 w-3.5 sm:mr-1" />}
            {/* On a phone the icon alone; the name stays for screen readers. */}
            <span className="sr-only sm:not-sr-only">{playing ? t("recordings.close") : t("recordings.listen")}</span>
          </Button>
        </div>
      </div>
      {playing && (
        <div className="mt-2 space-y-1">
          <Player
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            autoPlay
            preload="none"
            src={`${API}/${encodeURIComponent(r.id)}`}
            className="w-full"
            aria-label={r.title}
            onError={onError}
          />
          {unplayable && <p className="text-xs text-muted-foreground">{t("recordings.unplayable")}</p>}
        </div>
      )}
    </li>
  );
}
