// Requirement — product notes, 2026-11-03: «Каталог» is the admin's page.
//   · switch off → 404, nothing read; a student (switch on) → 404, nothing read;
//   · the admin sees the five lists and the students' requests; approving a
//     request (under the name the admin settled on) adds the entry and removes
//     the request; rejecting removes it; adding, renaming and removing change
//     the list; a refusal of the server is shown;
//   · taking an entry out asks first, and says jobs keep it.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const flags = vi.hoisted(() => ({ catalog: true }));
const admin = vi.hoisted(() => ({ value: true }));

vi.mock("@/skillklan/featureFlags", () => ({ getFeatureFlags: vi.fn(async () => ({ catalog: flags.catalog })) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => admin.value) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/actions/catalog.actions", () => ({
  getCatalogAdminData: vi.fn(),
  addCatalogItem: vi.fn(),
  renameCatalogItem: vi.fn(),
  removeCatalogItem: vi.fn(),
  approveCatalogItemRequest: vi.fn(),
  rejectCatalogItemRequest: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

import CatalogPage from "@/app/dashboard/catalog/page";
import CatalogAdmin from "@/components/catalog/CatalogAdmin";
import {
  addCatalogItem,
  approveCatalogItemRequest,
  getCatalogAdminData,
  rejectCatalogItemRequest,
  removeCatalogItem,
  renameCatalogItem,
} from "@/actions/catalog.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import type { CatalogEntryView } from "@/skillklan/catalog/kinds";
import type { CatalogRequestView } from "@/skillklan/catalog/catalog";

const entries: CatalogEntryView[] = [
  { id: "e1", kind: "skill", label: "Java", value: "java" },
  { id: "e2", kind: "skill", label: "Selenium", value: "selenium" },
  { id: "e3", kind: "company", label: "Acme", value: "acme" },
];
const requests: CatalogRequestView[] = [
  { id: "r1", kind: "skill", label: "Rust", requestedBy: "u1", requesterName: "Olena", createdAt: new Date("2026-11-03") },
  { id: "r2", kind: "company", label: "Globex", requestedBy: "u2", requesterName: "Ivan", createdAt: new Date("2026-11-03") },
];

beforeEach(() => {
  vi.clearAllMocks();
  flags.catalog = true;
  admin.value = true;
  vi.mocked(getCatalogAdminData).mockResolvedValue({ success: true, data: { entries, requests } });
});

describe("the page", () => {
  it("switch off → 404 and nothing is read", async () => {
    flags.catalog = false;
    await expect(CatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getCatalogAdminData).not.toHaveBeenCalled();
  });

  it("a student → 404 and nothing is read; the admin gets the page", async () => {
    admin.value = false;
    await expect(CatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getCatalogAdminData).not.toHaveBeenCalled();
    admin.value = true;
    render(await CatalogPage());
    expect(screen.getByRole("heading", { name: "Catalog" })).toBeInTheDocument();
    expect(getCatalogAdminData).toHaveBeenCalledTimes(1);
  });

  it("the server refusing the data → 404 too", async () => {
    vi.mocked(getCatalogAdminData).mockResolvedValue({ success: false, message: "no" });
    await expect(CatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the screen", () => {
  const open = () => render(<CatalogAdmin entries={entries} requests={requests} />);
  const tab = (name: RegExp | string) => screen.getByRole("tab", { name });

  it("opens on the requests when there are some, with how many; each tab is a list", async () => {
    open();
    expect(tab(/Requests/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/Requests/)).toHaveTextContent("2");
    expect(screen.getByText("from Olena")).toBeInTheDocument();
    for (const name of ["Skills", "Companies", "Job titles", "Locations", "Job sources"]) {
      expect(tab(name)).toBeInTheDocument();
    }
    await userEvent.click(tab("Skills"));
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Selenium")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("opens on the skills when nobody has asked for anything", () => {
    render(<CatalogAdmin entries={entries} requests={[]} />);
    expect(tab("Skills")).toHaveAttribute("aria-selected", "true");
    expect(tab("Requests")).not.toHaveTextContent("0");
  });

  it("approving sends the name the admin settled on; the entry appears, the request goes", async () => {
    vi.mocked(approveCatalogItemRequest).mockResolvedValue({
      success: true,
      data: { id: "e9", kind: "skill", label: "Rust lang", value: "rust lang" },
    });
    open();
    const u = userEvent.setup();
    const input = screen.getAllByLabelText("Name to add")[0];
    await u.clear(input);
    await u.type(input, "Rust lang");
    await u.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    expect(approveCatalogItemRequest).toHaveBeenCalledWith("r1", "Rust lang");
    await waitFor(() => expect(screen.queryByText("from Olena")).not.toBeInTheDocument());
    expect(screen.getByText("from Ivan")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Added to the catalog.");
    await u.click(tab("Skills"));
    expect(screen.getByText("Rust lang")).toBeInTheDocument();
  });

  it("rejecting removes the request and adds nothing", async () => {
    vi.mocked(rejectCatalogItemRequest).mockResolvedValue({ success: true });
    open();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Reject" })[1]);
    expect(rejectCatalogItemRequest).toHaveBeenCalledWith("r2");
    await waitFor(() => expect(screen.queryByText("from Ivan")).not.toBeInTheDocument());
    expect(toastSuccess).toHaveBeenCalledWith("Request rejected.");
  });

  it("a refusal of the server is shown and the request stays", async () => {
    vi.mocked(approveCatalogItemRequest).mockResolvedValue({ success: false, message: "Only the administrator can." });
    open();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Approve" })[0]);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Only the administrator can."));
    expect(screen.getByText("from Olena")).toBeInTheDocument();
  });

  it("adds an entry to the open list", async () => {
    vi.mocked(addCatalogItem).mockResolvedValue({ success: true, data: { id: "e8", kind: "skill", label: "Appium", value: "appium" } });
    open();
    const u = userEvent.setup();
    await u.click(tab("Skills"));
    await u.type(screen.getByLabelText("Add to the list"), "Appium");
    await u.click(screen.getByRole("button", { name: "Add" }));
    expect(addCatalogItem).toHaveBeenCalledWith("skill", "Appium");
    await waitFor(() => expect(screen.getByText("Appium")).toBeInTheDocument());
    expect(screen.getByLabelText("Add to the list")).toHaveValue("");
  });

  it("renames in place", async () => {
    vi.mocked(renameCatalogItem).mockResolvedValue({ success: true, data: { id: "e1", kind: "skill", label: "Java 17", value: "java" } });
    open();
    const u = userEvent.setup();
    await u.click(tab("Skills"));
    await u.click(screen.getByRole("button", { name: "Rename: Java" }));
    const input = screen.getByLabelText("New name");
    await u.clear(input);
    await u.type(input, "Java 17");
    await u.click(screen.getByRole("button", { name: "Save" }));
    expect(renameCatalogItem).toHaveBeenCalledWith("e1", "Java 17");
    await waitFor(() => expect(screen.getByText("Java 17")).toBeInTheDocument());
  });

  it("removing asks first and says jobs keep it; cancel changes nothing", async () => {
    vi.mocked(removeCatalogItem).mockResolvedValue({ success: true });
    open();
    const u = userEvent.setup();
    await u.click(tab("Skills"));
    await u.click(screen.getByRole("button", { name: "Remove: Java" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Jobs that already have it keep it/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(removeCatalogItem).not.toHaveBeenCalled();
    expect(screen.getByText("Java")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Remove: Java" }));
    await u.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    expect(removeCatalogItem).toHaveBeenCalledWith("e1");
    await waitFor(() => expect(screen.queryByText("Java")).not.toBeInTheDocument());
  });
});
