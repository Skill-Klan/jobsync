// @vitest-environment node
// Requirement — product notes, 2026-11-03: one shared catalog of skills,
// companies, job titles, locations and job sources, changed only by the admin:
//   · a name is accepted trimmed, 2 to 80 characters, and gets the key the
//     person's own rows use — so «Java» from the catalog and «java» typed by
//     hand are one row; a company's key drops «Inc», «LLC»…;
//   · a picker lists the catalog and nothing but the catalog — the person's own
//     row where they have one (its id), a `catalog:` entry where they have not —
//     plus what an older job was saved with.
import {
  CATALOG_KINDS,
  catalogEntryIdOf,
  catalogValue,
  cleanCatalogLabel,
  isCatalogKind,
  isCatalogOptionId,
  mergeCatalogOptions,
} from "@/skillklan/catalog/kinds";

describe("kinds", () => {
  it("exactly the five lists of the job form", () => {
    expect([...CATALOG_KINDS]).toEqual(["skill", "company", "jobTitle", "location", "jobSource"]);
  });

  it.each(["skill", "company", "jobTitle", "location", "jobSource"])("%s is a kind", (kind) =>
    expect(isCatalogKind(kind)).toBe(true),
  );
  it.each(["contact", "toString", "", undefined, 5, null])("%j is not", (kind) =>
    expect(isCatalogKind(kind)).toBe(false),
  );
});

describe("names", () => {
  it("are trimmed, squeezed and keyed like the person's own rows", () => {
    expect(cleanCatalogLabel("skill", "  Test   Cases ")).toEqual({ label: "Test Cases", value: "test cases" });
    expect(cleanCatalogLabel("skill", "Java")?.value).toBe(catalogValue("skill", "java"));
  });

  it("a company's key drops the legal suffix, other kinds keep it", () => {
    expect(catalogValue("company", "Acme Inc")).toBe("acme");
    expect(catalogValue("jobTitle", "Acme Inc")).toBe("acme inc");
  });

  it.each([["x"], [" "], ["a".repeat(81)], [""], [42], [null], [undefined]])(
    "%j is not a name the catalog accepts",
    (label) => expect(cleanCatalogLabel("skill", label)).toBeNull(),
  );

  it("2 and 80 characters are the edges", () => {
    expect(cleanCatalogLabel("skill", "QA")).not.toBeNull();
    expect(cleanCatalogLabel("skill", "a".repeat(80))).not.toBeNull();
  });
});

describe("mergeCatalogOptions", () => {
  const entries = [
    { id: "e-java", label: "Java", value: "java" },
    { id: "e-qa", label: "Manual QA", value: "manual qa" },
    { id: "e-aws", label: "AWS", value: "aws" },
  ];
  const own = [
    { id: "own-java", label: "java", value: "java" },
    { id: "own-rust", label: "Rust", value: "rust" }, // not in the catalog
    { id: "own-old", label: "Old", value: "old" }, // not in the catalog, a job holds it
  ];

  it("lists the catalog only — own rows outside it are not offered", () => {
    const options = mergeCatalogOptions(own, entries);
    expect(options.map((o) => o.label)).toEqual(["AWS", "Java", "Manual QA"]);
    expect(options.some((o) => o.id === "own-rust")).toBe(false);
  });

  it("an entry the person already has is their own row (its id); the catalog's label shows", () => {
    expect(mergeCatalogOptions(own, entries).find((o) => o.value === "java")).toEqual({
      id: "own-java",
      label: "Java",
      value: "java",
    });
  });

  it("an entry they have not used is a `catalog:` option", () => {
    const aws = mergeCatalogOptions(own, entries).find((o) => o.value === "aws")!;
    expect(aws.id).toBe("catalog:e-aws");
    expect(isCatalogOptionId(aws.id)).toBe(true);
    expect(catalogEntryIdOf(aws.id)).toBe("e-aws");
    expect(isCatalogOptionId("own-java")).toBe(false);
  });

  it("what an older job was saved with stays in the list; an unknown id adds nothing", () => {
    const options = mergeCatalogOptions(own, entries, ["own-old", "nobody", undefined]);
    expect(options.map((o) => o.id)).toContain("own-old");
    expect(options).toHaveLength(4);
  });

  it("a held row that is also in the catalog is not listed twice", () => {
    expect(mergeCatalogOptions(own, entries, ["own-java"]).filter((o) => o.value === "java")).toHaveLength(1);
  });

  it("an empty catalog offers nothing; the input is not changed", () => {
    const copy = JSON.stringify(own);
    expect(mergeCatalogOptions(own, [])).toEqual([]);
    expect(JSON.stringify(own)).toBe(copy);
  });
});
