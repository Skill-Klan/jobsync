// Requirement — the owner, 2026-11-19 (SKD-54, meeting item 7): the «Банк вакансій»
// download button "is not needed". The toolbar keeps reload, search and filters;
// the CSV export route is gone with it, so nothing answers without the button.
import { existsSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { JobsToolbar } from "@/components/myjobs/jobs-container/JobsToolbar";

vi.mock("@/components/myjobs/AddJob", () => ({ AddJob: () => <button>Add Job</button> }));
vi.mock("@/components/myjobs/jobs-container/JobsFilterPopover", () => ({ JobsFilterPopover: () => <div /> }));
vi.mock("@/components/myjobs/jobs-container/JobsFilterChips", () => ({ JobsFilterChips: () => <div /> }));

it("the job bank toolbar has no export/download button, but keeps reload and add", () => {
  render(<JobsToolbar {...({ initialLoading: false, totalJobs: 3, jobsCount: 3, searchTerm: "", facets: {}, scope: {}, statuses: [], companies: [], titles: [], locations: [], sources: [], tags: [], onClearLocationFilter() {}, onClearSourceFilter() {}, onReload() {}, onSearchTermChange() {}, onApplyFacets() {}, resetEditJob() {} } as any)} />);
  expect(screen.getByRole("button", { name: "Reload jobs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Job" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /export|download/i })).not.toBeInTheDocument();
});

it("the CSV export route no longer exists", () => {
  expect(existsSync(join(process.cwd(), "src/app/api/jobs/export/route.ts"))).toBe(false);
});
