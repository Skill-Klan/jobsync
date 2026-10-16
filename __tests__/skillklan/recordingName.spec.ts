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
    ["an empty part", "24.09.2026 -  - Acme.mp3"],
  ])("%s → shown by its raw name", (_label, name) => {
    expect(parseRecordingName(name)).toEqual({
      date: null,
      specializations: [],
      person: null,
      company: null,
      title: name.replace(/\.mp3$/, ""),
    });
  });

  it("a company with ' - ' in it keeps the person whole only up to the last part", () => {
    expect(parseRecordingName("24.09.2026 - Web - Іван Петренко - Ajax - Systems.mp3")).toMatchObject({
      specializations: ["Web"],
      person: "Іван Петренко - Ajax",
      company: "Systems",
    });
  });
});
