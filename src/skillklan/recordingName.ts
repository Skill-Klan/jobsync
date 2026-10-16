// What a recording's file name says. The Telegram bot names uploads
// `дата - [спеціалізація - ]хто - компанія.ext` (buildInterviewUploadFileName
// in the bot), e.g. `24.09.2026 - Mobile+API - Іван Петренко - Monobank.mp3`;
// uploads before 2026-09-24 have no specialization, and the old chat upload
// named files `компанія - ПІБ`. Anything else is shown as its raw name.
//
// Pure — used by the server when it lists the library.

export type RecordingNameParts = {
  date: string | null; // ISO yyyy-mm-dd
  specializations: string[];
  person: string | null;
  company: string | null;
  title: string; // the name without its extension
};

// The bot's specialization labels (interviewSpecialization.ts), joined by "+".
const SPECIALIZATIONS = new Set(["Web", "Mobile", "API", "Desktop", "GameDev", "Інше", "Загальна"]);
const DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function isoDate(part: string): string | null {
  const m = DATE.exec(part);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  // 31.02 is not a date
  if (d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function specializationsOf(part: string): string[] | null {
  const labels = part.split("+").map((s) => s.trim());
  return labels.length > 0 && labels.every((l) => SPECIALIZATIONS.has(l)) ? labels : null;
}

export function parseRecordingName(fileName: string): RecordingNameParts {
  const title = fileName.replace(/\.[^./\\]{1,5}$/, "").trim();
  const parts = title.split(" - ").map((p) => p.trim());
  const none: RecordingNameParts = { date: null, specializations: [], person: null, company: null, title };

  const date = parts.length >= 3 ? isoDate(parts[0]) : null;
  if (date) {
    const rest = parts.slice(1);
    const specs = rest.length >= 3 ? specializationsOf(rest[0]) : null;
    const tail = specs ? rest.slice(1) : rest;
    if (tail.length < 2 || tail.some((p) => !p)) return none;
    return {
      date,
      specializations: specs ?? [],
      person: tail.slice(0, -1).join(" - "),
      company: tail[tail.length - 1],
      title,
    };
  }
  // The old chat upload: `компанія - ПІБ`.
  if (parts.length === 2 && parts.every(Boolean)) {
    return { ...none, company: parts[0], person: parts[1] };
  }
  return none;
}
