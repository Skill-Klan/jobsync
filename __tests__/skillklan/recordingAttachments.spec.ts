// @vitest-environment node
// Requirement — the owner, 2026-10-19:
//   · D77 an attachment goes beside a recording "when that is certain", on its
//     folder otherwise. Certain: the folder holds one recording, or the
//     attachment's name starts with exactly one recording's name (then a
//     separator — "acme_tech_task", not "acmebank"); a name too short to be a
//     name proves nothing;
//   · D78 pictures and PDFs are viewed, and the other files too where the
//     browser can show them after conversion: Google documents (as PDF), Word
//     (as a page), text and code (as text); the rest is listed, not viewed;
//   · on the page: beside the recording, or on the folder — the company's
//     stage or the folder below it; a folder's attachments follow the
//     direction filter like its recordings.
import { attachmentView, recordingOf, type Attachment } from "@/skillklan/recordingAttachments";
import { NO_FILTERS, attachmentPlaces, folderKey } from "@/skillklan/recordingsLibrary";

const rec = (id: string, name: string) => ({ id, name });

describe("recordingOf — whose attachment it is (D77)", () => {
  it("the folder holds one recording → that one, whatever the names", () => {
    expect(recordingOf("screenshot.png", [rec("r1", "Олена_QA.m4a")])).toBe("r1");
  });

  it("no recording beside it → no one's", () => {
    expect(recordingOf("screenshot.png", [])).toBeNull();
  });

  it("several: the name starts with exactly one recording's name and a separator → that one", () => {
    const folder = [rec("r1", "Іван_Петренко_QA_24.09.25.m4a"), rec("r2", "Олена_Коваль_QA.ogg")];
    expect(recordingOf("Іван_Петренко_QA_24.09.25_task.jpg", folder)).toBe("r1");
    expect(recordingOf("олена_коваль_qa (2).png", folder)).toBe("r2"); // any case
    expect(recordingOf("Олена_Коваль_QA.pdf", folder)).toBe("r2"); // the same name
  });

  it("several, and the name says nothing → no one's (the folder)", () => {
    const folder = [rec("r1", "Іван_QA.m4a"), rec("r2", "Олена_QA.ogg")];
    expect(recordingOf("schema.pdf", folder)).toBeNull();
  });

  it("a name that only starts the same, without a separator, is not a match", () => {
    const folder = [rec("r1", "Acme.m4a"), rec("r2", "Other.m4a")];
    expect(recordingOf("Acmebank_task.png", folder)).toBeNull();
  });

  it("two recordings both start the name → the longer one", () => {
    const folder = [rec("r1", "acme_tech.m4a"), rec("r2", "acme_tech_2.m4a")];
    expect(recordingOf("acme_tech_2_task.png", folder)).toBe("r2");
    expect(recordingOf("acme_tech_task.png", folder)).toBe("r1");
  });

  it("two recordings with the same name (different types) → not certain", () => {
    const folder = [rec("r1", "interview.m4a"), rec("r2", "interview.ogg")];
    expect(recordingOf("interview_task.png", folder)).toBeNull();
  });

  it("a name too short to tell (\"1.m4a\") proves nothing", () => {
    const folder = [rec("r1", "1.m4a"), rec("r2", "2.m4a")];
    expect(recordingOf("1 task.png", folder)).toBeNull();
  });

  it("a recording named with a date keeps the date (it is not a type)", () => {
    const folder = [rec("r1", "QA_24.09.25"), rec("r2", "QA_24.09.26")];
    expect(recordingOf("QA_24.09.25_task.png", folder)).toBe("r1");
  });
});

describe("attachmentView — how it is shown (D78)", () => {
  it.each([
    ["image/png", "a.png", "image"],
    ["image/jpeg", "a.jpg", "image"],
    ["image/heic", "IMG_1.HEIC", "image"],
    ["application/pdf", "a.pdf", "pdf"],
    ["application/vnd.google-apps.document", "Нотатки", "pdf"],
    ["application/vnd.google-apps.spreadsheet", "Таблиця", "pdf"],
    ["application/vnd.google-apps.presentation", "Слайди", "pdf"],
    ["application/vnd.google-apps.drawing", "Схема", "pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx", "page"],
    ["text/plain", "a.txt", "text"],
    ["application/json", "a.json", "text"],
    ["application/octet-stream", "checklist.js", "text"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx", "none"],
    ["application/zip", "a.zip", "none"],
    ["application/vnd.google-apps.form", "Форма", "none"],
    ["application/octet-stream", "data.bin", "none"],
  ])("%s (%s) → %s", (mimeType, name, view) => {
    expect(attachmentView(mimeType, name)).toBe(view);
  });
});

describe("attachmentPlaces — where the page puts them", () => {
  const a = (id: string, kind: Attachment["kind"], company: string, folder: string | null, recordingId: string | null): Attachment => ({
    id, name: `${id}.png`, mimeType: "image/png", size: 1, kind, company, folder, recordingId, view: "image",
  });
  const list = [
    a("onRec", "qaTech", "Acme", null, "r1"),
    a("onStage", "qaTech", "Acme Bank", null, null),
    a("onSub", "qaTech", "ACME", "Кандидат_QA", null),
    a("baStage", "baTech", "Acme", null, null),
  ];

  it("a recording's — under the recording; a folder's — under company (any spelling) · stage · folder", () => {
    const { byRecording, byFolder } = attachmentPlaces(list, NO_FILTERS);
    expect(byRecording.get("r1")?.map((x) => x.id)).toEqual(["onRec"]);
    // "Acme Bank" and "Acme" are different companies; QA and BA technical are one stage.
    expect(byFolder.get(folderKey("acmebank", "tech", null))?.map((x) => x.id)).toEqual(["onStage"]);
    expect(byFolder.get(folderKey("acme", "tech", null))?.map((x) => x.id)).toEqual(["baStage"]);
    expect(byFolder.get(folderKey("acme", "tech", "Кандидат_QA"))?.map((x) => x.id)).toEqual(["onSub"]);
  });

  it("a direction picked → a folder's attachments of the other direction are not shown", () => {
    const { byFolder } = attachmentPlaces(list, { ...NO_FILTERS, direction: "qa" });
    expect(byFolder.get(folderKey("acme", "tech", null))).toBeUndefined();
    expect(byFolder.get(folderKey("acmebank", "tech", null))?.map((x) => x.id)).toEqual(["onStage"]);
  });
});
