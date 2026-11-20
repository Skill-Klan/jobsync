// The text of a transcript as people read it (owner 2026-11-20, D106: «з
// мітками» — who speaks, and when): consecutive words of one speaker make one
// segment; speakers are numbered 1, 2, … in the order they first speak.
//
// Pure and shared: the server turns the provider's words into segments once,
// and the browser formats the same segments for «Копіювати».

export type TranscriptSegment = {
  // 1, 2, … — the order in which the speakers are first heard.
  speaker: number;
  // Seconds from the start of the recording.
  start: number;
  text: string;
};

// One word of ElevenLabs speech-to-text (POST /v1/speech-to-text, `words`):
// a word, the spacing after it, or a non-speech sound (not requested).
export type ProviderWord = {
  text: string;
  type?: string;
  start?: number | null;
  speaker_id?: string | null;
};

export function segmentsFromWords(words: readonly ProviderWord[]): TranscriptSegment[] {
  const numbers = new Map<string, number>();
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;
  let currentKey: string | null = null;

  for (const word of words) {
    if (word.type === "audio_event") continue;
    if (word.type === "spacing") {
      if (current) current.text += word.text;
      continue;
    }
    // Without a speaker (diarization gave none) — all of it is one speaker.
    const key = word.speaker_id ?? "";
    if (!current || key !== currentKey) {
      if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
      const previousStart: number = segments.length > 0 ? segments[segments.length - 1].start : 0;
      current = { speaker: numbers.get(key)!, start: Math.max(0, word.start ?? previousStart), text: "" };
      currentKey = key;
      segments.push(current);
    }
    current.text += word.text;
  }

  return segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text.length > 0);
}

// 75 → "01:15"; an hour and more → "1:02:03".
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

// What «Копіювати» puts on the clipboard: «Спікер 1 (00:00): …», a blank line
// between speakers. `label` gives the speaker's name in the page's language.
export function transcriptAsText(
  segments: readonly TranscriptSegment[],
  label: (speaker: number) => string,
): string {
  return segments.map((s) => `${label(s.speaker)} (${clock(s.start)}): ${s.text}`).join("\n\n");
}

// The stored JSON back to segments; anything malformed is dropped, never thrown
// at the page.
export function parseSegments(json: string | null): TranscriptSegment[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { speaker, start, text } = item as Record<string, unknown>;
      if (!Number.isInteger(speaker) || (speaker as number) < 1) return [];
      if (typeof start !== "number" || !Number.isFinite(start)) return [];
      if (typeof text !== "string" || !text) return [];
      return [{ speaker: speaker as number, start, text }];
    });
  } catch {
    return [];
  }
}
