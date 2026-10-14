import { Paperclip } from "lucide-react";
import { useTranslations } from "@/i18n/client";

// Called as a plain function by its callers (not rendered as <DownloadFileButton>),
// so the hook lives in the component it returns.
export function DownloadFileButton(
  resumeId: string,
  filePath: any,
  fileTitle: string,
  fileName: string
) {
  return (
    <DownloadButton
      resumeId={resumeId}
      filePath={filePath}
      fileTitle={fileTitle}
      fileName={fileName}
    />
  );
}

function DownloadButton({
  resumeId,
  filePath,
  fileTitle,
  fileName,
}: {
  resumeId: string;
  filePath: any;
  fileTitle: string;
  fileName: string;
}) {
  const t = useTranslations("profile");
  const handleDownload = async () => {
    const response = await fetch(
      `/api/profile/resume?resumeId=${encodeURIComponent(resumeId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Stored basename carries a timestamp and, after a restore, a file id
      link.download = fileName || filePath.split("/").pop();
      link.target = "_blank";
      link.click();
      window.URL.revokeObjectURL(url); // Clean up
    } else {
      console.error("Failed to download file");
    }
  };

  return (
    <button
      className="flex items-center"
      onClick={handleDownload}
      title={t("resumePage.download", { fileName: fileName ?? "" })}
    >
      <div>{fileTitle}</div>
      <Paperclip className="h-3.5 w-3.5 ml-1" />
    </button>
  );
}
