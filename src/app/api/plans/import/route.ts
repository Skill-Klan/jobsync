import { NextResponse } from "next/server";
import { getTranslations } from "@/i18n/server";
import { handleImport } from "@/skillklan/plans/importHandlers";
import { SHEET_MAX_BYTES } from "@/skillklan/plans/sheetImport";

// The spreadsheet import of study plans (SKD-60), admin only (checked again
// with the backend inside). A route handler with its own size limit rather
// than a server action: the action body limit is global, and raising it for the
// whole app to carry one admin upload would widen it for every student's action.
// The session middleware covers /api; the cookie is SameSite=Lax, so another
// site cannot post here as the admin.
export const dynamic = "force-dynamic";

// The workbook plus the other form fields.
const OVERHEAD_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const t = await getTranslations("plans");
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > SHEET_MAX_BYTES + OVERHEAD_BYTES) {
    return NextResponse.json({ success: false, message: t("import.tooBig") }, { status: 413 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: t("errors.invalid") }, { status: 400 });
  }
  return NextResponse.json(await handleImport(formData));
}
