import { toast } from "sonner";
import type { ActionResult } from "@/models/action.model";
import enCommon from "@/i18n/messages/en/common.json";
import ukCommon from "@/i18n/messages/uk/common.json";

// Toasts are called outside React, so they read the page's own language from
// <html lang> (set by the root layout). Anything else — no DOM, a test page —
// gets the English text. Only the small `common` dictionaries are imported.
function commonText() {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return lang === "uk" ? ukCommon : enCommon;
}

export function toastSuccess(message: string, title?: string) {
  if (title) toast.success(title, { description: message });
  else toast.success(message);
}

export function toastError(message?: string, title?: string) {
  const text = message ?? commonText().genericError;
  if (title) toast.error(title, { description: text });
  else toast.error(text);
}

// For outcomes that are neither: a deliberate interruption is not an error.
export function toastInfo(message: string, title?: string) {
  if (title) toast.info(title, { description: message });
  else toast.info(message);
}

// Collapses the repeated success/error branch into one call.
export function toastActionResult<T>(
  result: ActionResult<T> | undefined,
  opts: { success: string; onSuccess?: (data: T | undefined) => void; error?: string },
) {
  if (result?.success) {
    toastSuccess(opts.success);
    opts.onSuccess?.(result.data);
  } else {
    toastError(result?.message ?? opts.error);
  }
}
