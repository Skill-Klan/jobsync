// Requirement — the owner, 2026-11-22 (SKD-66): the statistics list starts with
// the longest quiet first (never signed in, then the oldest sign-in) until another
// column header is clicked; a click sorts
// by it (biggest first), a second click flips it; the header says which way.
import { render, screen, fireEvent, within } from "@testing-library/react";
import UsageTable from "@/components/stats/UsageTable";
import type { TableRow } from "@/components/stats/usageSort";

const row = (name: string, jobs: number, modulesClosed = 0, modulesTotal = 0): TableRow => ({
  id: name, name, lastSignIn: null, lastSignInLabel: null, jobs, resumes: 0, resumesWithFile: 0, modulesClosed, modulesTotal,
});
const order = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent);

describe("UsageTable", () => {
  const rows = [row("Ann", 5), row("Bob", 31), row("Cat", 0)];

  it("starts with the longest quiet first, and the Last sign-in column says so", () => {
    const quiet = [
      { ...row("Recent", 1), lastSignIn: 9000, lastSignInLabel: "d" },
      { ...row("Never", 2) },
      { ...row("Old", 3), lastSignIn: 1000, lastSignInLabel: "d" },
    ];
    render(<UsageTable rows={quiet} />);
    expect(order()).toEqual(["Never", "Old", "Recent"]);
    expect(screen.getByRole("columnheader", { name: "Last sign-in" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "none");
  });

  it("a click on Vacancies sorts biggest first, a second click flips, and the header says so", () => {
    render(<UsageTable rows={rows} />);
    const button = screen.getByRole("button", { name: "Vacancies" });

    fireEvent.click(button);
    expect(order()).toEqual(["Bob", "Ann", "Cat"]);
    expect(screen.getByRole("columnheader", { name: "Vacancies" })).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(button);
    expect(order()).toEqual(["Cat", "Ann", "Bob"]);
    expect(screen.getByRole("columnheader", { name: "Vacancies" })).toHaveAttribute("aria-sort", "ascending");
  });

  it("shows modules as closed of all, and «no plan» for someone without one", () => {
    render(<UsageTable rows={[row("Dan", 0, 3, 9), row("Eve", 0)]} />);
    expect(screen.getByText("3 of 9")).toBeInTheDocument();
    expect(screen.getByText("no plan")).toBeInTheDocument();
  });
});
