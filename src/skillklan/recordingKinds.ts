// The six kinds of interview recording — one Google Drive folder each, as the
// Telegram bot files uploads: direction (QA, BA) × the form's interview type
// (Рекрутерська, Технічна, Менеджерська). Shared by the server (folders) and
// the library (filter, labels).
export const RECORDING_KIND_KEYS = [
  "qaRecruiter",
  "qaTech",
  "qaManager",
  "baRecruiter",
  "baTech",
  "baManager",
] as const;

export type RecordingKind = (typeof RECORDING_KIND_KEYS)[number];
