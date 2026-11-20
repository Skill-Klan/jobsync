// @vitest-environment node
// Requirement — the owner, 2026-11-20 (D106): the transcript shows who speaks
// and when — «Спікер 1 / Спікер 2» with the time — not one block of text; and
// «Копіювати» copies it so it can be pasted elsewhere. Speakers are numbered
// in the order they are first heard (the provider's own ids — speaker_0,
// speaker_1 … — are not an order). The words come in ElevenLabs' shape
// (POST /v1/speech-to-text, `words`: word / spacing / audio_event, start in
// seconds, speaker_id) — docs read 2026-11-20.
import { clock, parseSegments, segmentsFromWords, transcriptAsText } from "@/skillklan/transcripts/segments";

const w = (text: string, start: number, speaker: string | null) => ({ text, type: "word", start, speaker_id: speaker });
const sp = (speaker: string | null) => ({ text: " ", type: "spacing", start: null, speaker_id: speaker });

describe("segmentsFromWords", () => {
  it("one segment per turn; speakers numbered by who is heard first, not by the provider's ids", () => {
    const words = [
      w("Добрий", 0.4, "speaker_1"), sp("speaker_1"), w("день!", 0.9, "speaker_1"), sp("speaker_1"),
      w("Вітаю.", 2.0, "speaker_0"), sp("speaker_0"), w("Почнемо?", 2.6, "speaker_0"), sp("speaker_0"),
      w("Так.", 75.2, "speaker_1"),
    ];
    expect(segmentsFromWords(words)).toEqual([
      { speaker: 1, start: 0.4, text: "Добрий день!" },
      { speaker: 2, start: 2.0, text: "Вітаю. Почнемо?" },
      { speaker: 1, start: 75.2, text: "Так." },
    ]);
  });

  it("sounds (laughter…) are not text; empty turns are dropped", () => {
    const words = [
      w("Так", 1, "speaker_0"),
      { text: "(сміх)", type: "audio_event", start: 1.5, speaker_id: "speaker_1" },
      sp("speaker_0"),
      w("звісно", 2, "speaker_0"),
    ];
    expect(segmentsFromWords(words)).toEqual([{ speaker: 1, start: 1, text: "Так звісно" }]);
  });

  it("no speaker from the provider — all of it is speaker 1; silence — no segments at all", () => {
    expect(segmentsFromWords([w("Раз", 0, null), sp(null), w("два", 1, null)])).toEqual([
      { speaker: 1, start: 0, text: "Раз два" },
    ]);
    expect(segmentsFromWords([])).toEqual([]);
  });
});

describe("what «Копіювати» copies", () => {
  it("«Спікер N (мм:сс): текст», a blank line between turns; an hour and more — г:мм:сс", () => {
    const segments = [
      { speaker: 1, start: 0.4, text: "Добрий день!" },
      { speaker: 2, start: 75.9, text: "Вітаю." },
      { speaker: 1, start: 3723, text: "Дякую." },
    ];
    expect(transcriptAsText(segments, (n) => `Спікер ${n}`)).toBe(
      "Спікер 1 (00:00): Добрий день!\n\nСпікер 2 (01:15): Вітаю.\n\nСпікер 1 (1:02:03): Дякую.",
    );
    expect(clock(59.99)).toBe("00:59");
  });
});

describe("parseSegments — the stored text back", () => {
  it("keeps good segments, drops malformed ones, never throws", () => {
    const stored = JSON.stringify([
      { speaker: 1, start: 0, text: "Так" },
      { speaker: 0, start: 1, text: "нуль — не спікер" },
      { speaker: 2, start: "1", text: "час рядком" },
      { speaker: 2, start: 3, text: "" },
      null,
    ]);
    expect(parseSegments(stored)).toEqual([{ speaker: 1, start: 0, text: "Так" }]);
    expect(parseSegments("{not json")).toEqual([]);
    expect(parseSegments(null)).toEqual([]);
  });
});
