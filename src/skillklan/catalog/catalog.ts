import { Prisma } from "@prisma/client";
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
type Reason = "bad_kind" | "bad_label" | "exists" | "not_found";
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

// What the person created and the admin has not answered yet: their picker keeps
// showing these next to the catalog (the rest of their own rows is not offered).
export async function listMyPendingValues(userId: string): Promise<{ kind: CatalogKind; value: string }[]> {
  const rows = await prisma.catalogRequest.findMany({
    where: { requestedBy: userId, status: "pending" },
    select: { kind: true, value: true },
  });
  return rows.filter((r): r is { kind: CatalogKind; value: string } => isCatalogKind(r.kind));
}

export type CatalogRequestView = {
  id: string;
  kind: CatalogKind;
  label: string;
  value: string;
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
      value: r.value,
      requestedBy: r.requestedBy,
      requesterName: r.User.name,
      createdAt: r.createdAt,
    }));
}

// A student's new value (owner 2026-11-21, SKD-59): it exists for them at once,
// and a copy goes to the admin as a pending request, so a misspelling
// ("Raifeisen Bank") can be corrected or replaced for everybody. A value the
// catalog already has is just the person's own row for it — nothing to review.
// One request per person, kind and value. One the admin corrected comes back
// when the same value is created again (the typo is gone from their rows, so
// this is a new one); one the admin left as it is stays closed.
export async function createOwnValue(userId: string, kind: unknown, label: unknown) {
  if (!isCatalogKind(kind)) return fail("bad_kind");
  const clean = cleanCatalogLabel(kind, label);
  if (!clean) return fail("bad_label");
  const entry = await prisma.catalogEntry.findUnique({ where: { kind_value: { kind, value: clean.value } } });
  const list = own(kind);
  const where = { value_createdBy: { value: clean.value, createdBy: userId } };
  let row = await list.findUnique({ where });
  if (!row) {
    try {
      row = await list.create({ data: { label: entry?.label ?? clean.label, value: clean.value, createdBy: userId } });
    } catch (err) {
      // Two creations at once: the loser finds the winner's row.
      if ((err as { code?: string })?.code !== "P2002") throw err;
      row = await list.findUnique({ where });
      if (!row) throw err;
    }
  }
  if (!entry) {
    await prisma.catalogRequest.upsert({
      where: { kind_value_requestedBy: { kind, value: clean.value, requestedBy: userId } },
      update: {},
      create: { kind, label: clean.label, value: clean.value, requestedBy: userId },
    });
    await prisma.catalogRequest.updateMany({
      where: { kind, value: clean.value, requestedBy: userId, status: "approved" },
      data: { status: "pending", label: clean.label, decidedAt: null, decidedByCabinetUserId: null },
    });
  }
  return { ok: true as const, row: toOption(row) };
}

type Tx = Prisma.TransactionClient;
type Row = Record<string, unknown> & { id: string; createdBy: string; label: string; value: string };

const MODEL: Record<CatalogKind, string> = {
  skill: "Tag",
  company: "Company",
  jobTitle: "JobTitle",
  location: "Location",
  jobSource: "JobSource",
};
const delegateOf = (tx: Tx, model: string) =>
  (tx as unknown as Record<string, any>)[model.charAt(0).toLowerCase() + model.slice(1)];

// Everything that points at a row of `model`, read from the Prisma schema so a
// relation added later is moved too: scalar foreign keys, and many-to-many
// links (a skill on jobs and questions).
function references(model: string) {
  const models = Prisma.dmmf.datamodel.models;
  const keys: { model: string; field: string }[] = [];
  const links: { model: string; field: string }[] = [];
  for (const m of models) {
    for (const f of m.fields) {
      if (f.kind !== "object" || f.type !== model) continue;
      if (f.relationFromFields?.length === 1) keys.push({ model: m.name, field: f.relationFromFields[0] });
      else if (f.isList) {
        // A many-to-many link: the other side lists this model back.
        const back = models.find((x) => x.name === model)?.fields.find((x) => x.relationName === f.relationName && x.isList);
        if (back) links.push({ model: m.name, field: f.name });
      }
    }
  }
  return { keys, links };
}

// Moves what every person saved under the key `from` onto their own row for the
// catalog entry `to` (made when they have none), then drops the old row. This is
// the correction: "Raifeisen Bank" → "Raiffeisen Bank" shows up in every job,
// work record and contact that had it. Same key, new spelling: only the label.
async function moveValues(tx: Tx, kind: CatalogKind, from: string, to: { value: string; label: string }) {
  const model = MODEL[kind];
  const list = delegateOf(tx, model);
  if (from === to.value) {
    await list.updateMany({ where: { value: from }, data: { label: to.label } });
    return;
  }
  const { keys, links } = references(model);
  const olds: Row[] = await list.findMany({ where: { value: from } });
  for (const old of olds) {
    const where = { value_createdBy: { value: to.value, createdBy: old.createdBy } };
    const target: Row =
      (await list.findUnique({ where })) ??
      (await list.create({ data: { label: to.label, value: to.value, createdBy: old.createdBy } }));
    for (const key of keys) await delegateOf(tx, key.model).updateMany({ where: { [key.field]: old.id }, data: { [key.field]: target.id } });
    for (const link of links) {
      const owner = delegateOf(tx, link.model);
      const rows: { id: string }[] = await owner.findMany({ where: { [link.field]: { some: { id: old.id } } }, select: { id: true } });
      for (const row of rows) {
        await owner.update({ where: { id: row.id }, data: { [link.field]: { disconnect: { id: old.id }, connect: { id: target.id } } } });
      }
    }
    // What the old row knew and the target does not (a logo, a watch) is kept.
    const fill: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(old)) {
      if (["id", "label", "value", "createdBy"].includes(field) || value === null || value === false) continue;
      if (target[field] === null || target[field] === false) fill[field] = value;
    }
    await list.delete({ where: { id: old.id } });
    if (Object.keys(fill).length > 0) await list.update({ where: { id: target.id }, data: fill });
    await list.update({ where: { id: target.id }, data: { label: to.label } });
  }
}

// The admin answers a request: the entry (found, or made under the label the
// admin settled on) takes over the key the student typed — and with it every
// person's rows under that key. Closes every pending request for it.
async function settle(request: { id: string; kind: CatalogKind; value: string }, entryOf: (tx: Tx) => Promise<{ id: string; kind: string; label: string; value: string } | null>, cabinetUserId: number) {
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const entry = await entryOf(tx);
      if (!entry) return null;
      await moveValues(tx, request.kind, request.value, entry);
      await tx.catalogRequest.updateMany({
        where: { kind: request.kind, status: "pending", value: { in: [request.value, entry.value] } },
        data: { status: "approved", decidedAt: now, decidedByCabinetUserId: cabinetUserId },
      });
      return entry;
    },
    { timeout: 30_000 },
  );
}

async function pendingRequest(id: unknown) {
  if (typeof id !== "string") return null;
  const request = await prisma.catalogRequest.findUnique({ where: { id } });
  if (!request || request.status !== "pending" || !isCatalogKind(request.kind)) return null;
  return { ...request, kind: request.kind as CatalogKind };
}

// Approving puts the entry in the catalog under the label the admin settled on
// (the student's own spelling by default) and moves everybody's rows onto it.
// A label the catalog already has is a replacement by that entry.
export async function approveCatalogRequest(id: unknown, label: unknown, cabinetUserId: number) {
  const request = await pendingRequest(id);
  if (!request) return fail("not_found");
  const clean = cleanCatalogLabel(request.kind, label ?? request.label);
  if (!clean) return fail("bad_label");
  const kind = request.kind;
  const entry = await settle(
    request,
    async (tx) =>
      (await tx.catalogEntry.findUnique({ where: { kind_value: { kind, value: clean.value } } })) ??
      (await tx.catalogEntry.create({ data: { kind, label: clean.label, value: clean.value, createdByCabinetUserId: cabinetUserId } })),
    cabinetUserId,
  );
  return entry ? { ok: true as const, entry: view(entry) } : fail("not_found");
}

// «Replace with an existing one»: the entry the admin picked takes over.
export async function replaceCatalogRequest(id: unknown, entryId: unknown, cabinetUserId: number) {
  const request = await pendingRequest(id);
  if (!request || typeof entryId !== "string") return fail("not_found");
  const entry = await settle(
    request,
    async (tx) => {
      const found = await tx.catalogEntry.findUnique({ where: { id: entryId } });
      return found && found.kind === request.kind ? found : null;
    },
    cabinetUserId,
  );
  return entry ? { ok: true as const, entry: view(entry) } : fail("not_found");
}

// «Leave as it is»: the student keeps their own value, nothing is changed for
// anybody, and the request is closed.
export async function rejectCatalogRequest(id: unknown, cabinetUserId: number) {
  const request = await pendingRequest(id);
  if (!request) return fail("not_found");
  await prisma.catalogRequest.update({
    where: { id: request.id },
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
