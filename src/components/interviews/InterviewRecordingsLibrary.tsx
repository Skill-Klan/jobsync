"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Play, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveCardHeader } from "../ResponsiveCardHeader";
import Loading from "../Loading";
import { RecordsCount } from "../RecordsCount";
import { SearchInput } from "../SearchInput";
import { useTranslations } from "@/i18n/client";
import { RECORDING_KIND_KEYS, type RecordingKind } from "@/skillklan/recordingKinds";

// The interview recordings library (owner 2026-10-16): every recording the
// students uploaded through the Telegram bot, for everyone to listen to. The
// files stay in Google Drive; the player streams them through this server
// (api/skillklan/interview-recordings), so seeking works and nothing of
// Google's reaches the browser.

export type LibraryRecording = {
  id: string;
  kind: RecordingKind;
  mimeType: string;
  date: string | null;
  specializations: string[];
  person: string | null;
  company: string | null;
  title: string;
};

const ALL = "all";
const API = "/api/skillklan/interview-recordings";

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function InterviewRecordingsLibrary() {
  const t = useTranslations("interviews");
  const [recordings, setRecordings] = useState<LibraryRecording[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<RecordingKind | undefined>(undefined);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [unplayable, setUnplayable] = useState<string | null>(null);

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

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (recordings ?? []).filter(
      (r) =>
        (!kind || r.kind === kind) &&
        (!needle ||
          [r.title, r.person, r.company, ...r.specializations].some((v) =>
            v?.toLowerCase().includes(needle),
          )),
    );
  }, [recordings, query, kind]);

  const filtered = Boolean(query.trim()) || kind !== undefined;

  return (
    <Card>
      <ResponsiveCardHeader>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <CardTitle>{t("recordings.title")}</CardTitle>
            {recordings && recordings.length > 0 && (
              <RecordsCount
                count={shown.length}
                total={recordings.length}
                label={t("recordings.recordsLabel")}
              />
            )}
          </div>
          <CardDescription>{t("recordings.description")}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          <Select
            value={kind ?? ALL}
            onValueChange={(v) => setKind(v === ALL ? undefined : (v as RecordingKind))}
          >
            <SelectTrigger aria-label={t("recordings.kindFilter")} className="h-8 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("recordings.allKinds")}</SelectItem>
              {RECORDING_KIND_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`recordings.kinds.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("recordings.searchPlaceholder")}
          />
        </div>
      </ResponsiveCardHeader>
      <CardContent>
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
        ) : (
          <ul className="divide-y">
            {shown.map((r) => {
              const playing = playingId === r.id;
              const src = `${API}/${encodeURIComponent(r.id)}`;
              const Player = r.mimeType.startsWith("video/") ? "video" : "audio";
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {r.date ? displayDate(r.date) : t("recordings.noDate")}
                    </span>
                    <Badge variant="secondary">{t(`recordings.kinds.${r.kind}`)}</Badge>
                    {r.specializations.length > 0 && (
                      <Badge variant="outline">{r.specializations.join(" + ")}</Badge>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.company || r.person ? (
                        <>
                          <span className="font-medium">{r.company}</span>
                          {r.company && r.person ? " · " : null}
                          {r.person}
                        </>
                      ) : (
                        r.title
                      )}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={playing ? "secondary" : "outline"}
                        onClick={() => {
                          setUnplayable(null);
                          setPlayingId(playing ? null : r.id);
                        }}
                      >
                        {playing ? (
                          <X className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <Play className="mr-1 h-3.5 w-3.5" />
                        )}
                        {playing ? t("recordings.close") : t("recordings.listen")}
                      </Button>
                      <Button asChild size="sm" variant="ghost" title={t("recordings.download")}>
                        <a href={`${src}?download=1`} aria-label={`${t("recordings.download")}: ${r.title}`}>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  {playing && (
                    <div className="mt-2 space-y-1">
                      <Player
                        controls
                        autoPlay
                        preload="none"
                        src={src}
                        className="w-full"
                        aria-label={r.title}
                        onError={() => setUnplayable(r.id)}
                      />
                      {unplayable === r.id && (
                        <p className="text-xs text-muted-foreground">{t("recordings.unplayable")}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
