// @vitest-environment node
// Requirement — the library shows what each recording is (owner 2026-10-16:
// date, interview, specialization, the person who uploaded it, the company).
// The names are the Telegram bot's: `дата - [спеціалізація - ]хто - компанія.ext`
// (with no specialization before 2026-09-24), the old chat upload's
// `компанія - ПІБ`, and anything else — shown as it is.
import { parseRecordingName } from "@/skillklan/recordingName";

describe("parseRecordingName", () => {
  it("the bot's full name: date, specializations, person, company", () => {
    expect(parseRecordingName("24.09.2026 - Mobile+API - Іван Петренко - Monobank.mp3")).toEqual({
      date: "2026-09-24",
      specializations: ["Mobile", "API"],
      person: "Іван Петренко",
      company: "Monobank",
      title: "24.09.2026 - Mobile+API - Іван Петренко - Monobank",
    });
  });

  it("before specializations: date, person, company", () => {
    expect(parseRecordingName("02.09.2026 - Олена Коваль - SoftServe.m4a")).toMatchObject({
      date: "2026-09-02",
      specializations: [],
      person: "Олена Коваль",
      company: "SoftServe",
    });
  });

  it("a person named like a specialization is still the person when there are only three parts", () => {
    expect(parseRecordingName("02.09.2026 - Web - Acme.mp3")).toMatchObject({
      specializations: [],
      person: "Web",
      company: "Acme",
    });
  });

  it("the old chat upload: company - person", () => {
    expect(parseRecordingName("EPAM - Марія Іваненко.ogg")).toMatchObject({
      date: null,
      company: "EPAM",
      person: "Марія Іваненко",
    });
  });

  it.each([
    ["no separators", "voice message.mp3"],
    ["not a date", "31.02.2026 - Іван - Acme.mp3"],
  ])("%s → shown by its raw name", (_label, name) => {
    expect(parseRecordingName(name)).toEqual({
      date: null,
      specializations: [],
      person: null,
      company: null,
      title: name.replace(/\.mp3$/, ""),
    });
  });
  it("an empty part → its raw name, but the date in it still counts", () => {
    expect(parseRecordingName("24.09.2026 -  - Acme.mp3")).toEqual({
      date: "2026-09-24",
      specializations: [],
      person: null,
      company: null,
      title: "24.09.2026 -  - Acme",
    });
  });


  it("a company with ' - ' in it keeps the person whole only up to the last part", () => {
    expect(parseRecordingName("24.09.2026 - Web - Іван Петренко - Ajax - Systems.mp3")).toMatchObject({
      specializations: ["Web"],
      person: "Іван Петренко - Ajax",
      company: "Systems",
    });
  });

  // Owner 2026-10-18: the archive in the company folders has its own names,
  // e.g. `Імʼя_Прізвище_QA_дд.мм.рр`; the date in them is the interview day.
  it.each([
    ["at the end, two-digit year", "Іван_Петренко_QA_24.09.25.m4a", "2025-09-24"],
    ["in the middle, four-digit year", "Петренко_24.09.2025_Middle.ogg", "2025-09-24"],
    ["right at the start", "05.03.26_Ajax_HR.ogg", "2026-03-05"],
  ])("a date inside an archive name (%s) → that day", (_label, name, date) => {
    expect(parseRecordingName(name)).toMatchObject({ date, person: null, company: null });
  });

  it.each([
    ["not a day", "Петренко_31.02.25.m4a"],
    ["a version, not a date", "Звіт v1.2.3.mp3"],
    ["digits glued on", "Петренко_124.09.25.m4a"],
    ["no date at all", "Іван_Петренко_EPAM.m4a"],
  ])("%s → no date", (_label, name) => {
    expect(parseRecordingName(name).date).toBeNull();
  });
});
