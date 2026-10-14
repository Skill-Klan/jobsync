"use client";
import { ListCollapse, MoreVertical, StickyNote, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { JobResponse, JobStatus } from "@/models/job.model";
import { JobStatusMenuItems } from "./JobStatusMenuItems";
import { useTranslations } from "@/i18n/client";

type JobActionsMenuProps = {
  job: JobResponse;
  jobStatuses: JobStatus[];
  onChangeJobStatus: (id: string, status: JobStatus) => void;
  onAddNote: (jobId: string) => void;
};

export function JobActionsMenu({
  job,
  jobStatuses,
  onChangeJobStatus,
  onAddNote,
}: JobActionsMenuProps) {
  const router = useRouter();
  const t = useTranslations("jobs");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-haspopup="true"
          size="icon"
          variant="ghost"
          data-testid="job-actions-menu-btn"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">{t("ui.toggleMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>{t("ui.actions")}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push(`/dashboard/myjobs/${job?.id}`)}
          >
            <ListCollapse className="mr-2 h-4 w-4" />
            {t("ui.viewDetails")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onAddNote(job.id)}
          >
            <StickyNote className="mr-2 h-4 w-4" />
            {t("ui.addNote")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tags className="mr-2 h-4 w-4" />
              {t("ui.changeStatus")}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="p-0">
                <JobStatusMenuItems
                  jobStatuses={jobStatuses}
                  currentStatusId={job.Status.id}
                  onSelectStatus={(status) => onChangeJobStatus(job.id, status)}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
