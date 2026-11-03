import prisma from "@/lib/db";
import {
  type CatalogEntryView,
  type CatalogKind,
  type PickerOption,
  cleanCatalogLabel,
  isCatalogKind,
} from "./kinds";

// The shared catalog, in the database (CatalogEntry, CatalogRequest). Every
// function answers `{ ok: true, … }` or `{ ok: false, reason }`; the actions
// (src/actions/catalog.actions.ts) check the switch and the role first and turn
// a reason into a message.
type Reason = "bad_kind" | "bad_label" | "exists" | "not_found" | "in_catalog";
type Fail = { ok: false; reason: Reason };
const fail = (reason: Reason): Fail => ({ ok: false, reason });

// The person's own list for each kind: same key, label, createdBy everywhere.
function ownList(kind: CatalogKind) {
  switch (kind) {
    case "skill":
      return prisma.tag;
    case "company":
      return prisma.company;
    case "jobTitle":
      return prisma.jobTitle;
    case "location":
      return prisma.location;
    case "jobSource":
      return prisma.jobSource;
  }
}

type OwnRow = { id: string; label: string; value: string };
type OwnDelegate = {
  findUnique(args: unknown): Promise<OwnRow | null>;
  create(args: unknown): Promise<OwnRow>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
const own = (kind: CatalogKind) => ownList(kind) as unknown as OwnDelegate;

function view(row: { id: string; kind: string; label: string; value: string }): CatalogEntryView {
  return { id: row.id, kind: row.kind as CatalogKind, label: row.label, value: row.value };
}

export async function listCatalog(): Promise<CatalogEntryView[]> {
  const rows = await prisma.catalogEntry.findMany({ orderBy: { label: "asc" } });
  return rows.filter((r) => isCatalogKind(r.kind)).map(view);
}

export async function addCatalogEntry(kind: unknown, label: unknown, cabinetUserId: number) {
  if (!isCatalogKind(kind)) return fail("bad_kind");
  const clean = cleanCatalogLabel(kind, label);
  if (!clean) return fail("bad_label");
  const existing = await prisma.catalogEntry.findUnique({ where: { kind_value: { kind, value: clean.value } } });
  if (existing) return fail("exists");
  const entry = await prisma.catalogEntry.create({
    data: { kind, label: clean.label, value: clean.value, createdByCabinetUserId: cabinetUserId },
  });
  return { ok: true as const, entry: view(entry) };
}

// A rename changes the label only — the key stays, so everybody's own rows
// that share it stay linked, and they get the new label too.
export async function renameCatalogEntry(id: unknown, label: unknown) {
  if (typeof id !== "string") return fail("not_found");
  const entry = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!entry || !isCatalogKind(entry.kind)) return fail("not_found");
  const clean = cleanCatalogLabel(entry.kind, label);
  if (!clean) return fail("bad_label");
  const clash = await prisma.catalogEntry.findFirst({
    where: { kind: entry.kind, value: clean.value, NOT: { id } },
  });
  if (clash) return fail("exists");
  const kind = entry.kind;
  const renamed = await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogEntry.update({ where: { id }, data: { label: clean.label } });
    const delegates = { skill: tx.tag, company: tx.company, jobTitle: tx.jobTitle, location: tx.location, jobSource: tx.jobSource };
    await (delegates[kind] as unknown as OwnDelegate).updateMany({
      where: { value: entry.value },
      data: { label: clean.label },
    });
    return updated;
  });
  return { ok: true as const, entry: view(renamed) };
}

// Taking an entry out of the catalog only takes it out of the pickers: what
// people have already saved with it stays on their jobs.
export async function removeCatalogEntry(id: unknown) {
  if (typeof id !== "string") return fail("not_found");
  const entry = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!entry) return fail("not_found");
  await prisma.catalogEntry.delete({ where: { id } });
  return { ok: true as const };
}

export type CatalogRequestView = {
  id: string;
  kind: CatalogKind;
  label: string;
  requestedBy: string;
  requesterName: string;
  createdAt: Date;
};

export async function listPendingRequests(): Promise<CatalogRequestView[]> {
  const rows = await prisma.catalogRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { User: { select: { name: true } } },
  });
  return rows
    .filter((r) => isCatalogKind(r.kind))
    .map((r) => ({
      id: r.id,
      kind: r.kind as CatalogKind,
      label: r.label,
      requestedBy: r.requestedBy,
      requesterName: r.User.name,
      createdAt: r.createdAt,
    }));
}

// A student's suggestion. Asking twice is one request; asking for what the
// catalog already has is refused (the answer tells them to pick it).
export async function requestCatalogEntry(userId: string, kind: unknown, label: unknown) {
  if (!isCatalogKind(kind)) return fail("bad_kind");
  const clean = cleanCatalogLabel(kind, label);
  if (!clean) return fail("bad_label");
  const inCatalog = await prisma.catalogEntry.findUnique({ where: { kind_value: { kind, value: clean.value } } });
  if (inCatalog) return fail("in_catalog");
  const key = { kind_value_requestedBy: { kind, value: clean.value, requestedBy: userId } };
  const before = await prisma.catalogRequest.findUnique({ where: key });
  if (before?.status === "pending") return { ok: true as const, again: true };
  await prisma.catalogRequest.upsert({
    where: key,
    update: { status: "pending", label: clean.label, decidedAt: null, decidedByCabinetUserId: null },
    create: { kind, label: clean.label, value: clean.value, requestedBy: userId },
  });
  return { ok: true as const, again: false };
}

// Approving puts the entry in the catalog (under the label the admin settled
// on) and closes every pending request for the same thing, whoever sent it.
export async function approveCatalogRequest(id: unknown, label: unknown, cabinetUserId: number) {
  if (typeof id !== "string") return fail("not_found");
  const request = await prisma.catalogRequest.findUnique({ where: { id } });
  if (!request || request.status !== "pending" || !isCatalogKind(request.kind)) return fail("not_found");
  const kind = request.kind;
  const clean = cleanCatalogLabel(kind, label ?? request.label);
  if (!clean) return fail("bad_label");
  const now = new Date();
  const entry = await prisma.$transaction(async (tx) => {
    const found = await tx.catalogEntry.findUnique({ where: { kind_value: { kind, value: clean.value } } });
    const made =
      found ??
      (await tx.catalogEntry.create({
        data: { kind, label: clean.label, value: clean.value, createdByCabinetUserId: cabinetUserId },
      }));
    await tx.catalogRequest.updateMany({
      where: { kind, status: "pending", value: { in: [request.value, clean.value] } },
      data: { status: "approved", decidedAt: now, decidedByCabinetUserId: cabinetUserId },
    });
    return made;
  });
  return { ok: true as const, entry: view(entry) };
}

export async function rejectCatalogRequest(id: unknown, cabinetUserId: number) {
  if (typeof id !== "string") return fail("not_found");
  const request = await prisma.catalogRequest.findUnique({ where: { id } });
  if (!request || request.status !== "pending") return fail("not_found");
  await prisma.catalogRequest.update({
    where: { id },
    data: { status: "rejected", decidedAt: new Date(), decidedByCabinetUserId: cabinetUserId },
  });
  return { ok: true as const };
}

// The person's own row for a catalog entry — made on the first pick, found on
// every later one. It carries the catalog's key and label, so the rest of the
// app (jobs, filters, statistics) keeps working on the person's own rows.
export async function materializeCatalogEntry(userId: string, entryId: unknown) {
  if (typeof entryId !== "string") return fail("not_found");
  const entry = await prisma.catalogEntry.findUnique({ where: { id: entryId } });
  if (!entry || !isCatalogKind(entry.kind)) return fail("not_found");
  const list = own(entry.kind);
  const where = { value_createdBy: { value: entry.value, createdBy: userId } };
  const found = await list.findUnique({ where });
  if (found) return { ok: true as const, row: toOption(found) };
  try {
    const created = await list.create({ data: { label: entry.label, value: entry.value, createdBy: userId } });
    return { ok: true as const, row: toOption(created) };
  } catch (err) {
    // Two picks at once: the loser finds the winner's row.
    if ((err as { code?: string })?.code === "P2002") {
      const winner = await list.findUnique({ where });
      if (winner) return { ok: true as const, row: toOption(winner) };
    }
    throw err;
  }
}

const toOption = (row: OwnRow): PickerOption => ({ id: row.id, label: row.label, value: row.value });
