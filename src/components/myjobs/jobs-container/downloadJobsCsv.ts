import { format } from "date-fns";
import { toastError, toastSuccess } from "@/lib/toast";

// The toasts are passed in already translated: this runs from a click, not
// from a component render, so it cannot take the translation hook itself.
export type DownloadJobsMessages = {
  downloaded: string;
  failed: string;
  unknownError: string;
};

export async function downloadJobsList(messages: DownloadJobsMessages) {
  try {
    const res = await fetch("/api/jobs/export", {
      method: "POST",
      headers: {
        "Content-Type": "text/csv",
      },
    });
    if (!res.ok) {
      throw new Error(messages.failed);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobsync-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess(messages.downloaded);
  } catch (error) {
    toastError(
      error instanceof Error ? error.message : messages.unknownError,
    );
  }
}
