"use client";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tag } from "@/models/job.model";
import { MoreVertical, Trash } from "lucide-react";
import { useState } from "react";
import { deleteTagById } from "@/actions/tag.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";
import { useTranslations } from "@/i18n/client";

type TagsTableProps = {
  tags: Tag[];
  reloadTags: () => void;
};

function TagsTable({ tags, reloadTags }: TagsTableProps) {
  const t = useTranslations("library");
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteTag = (tag: Tag) => {
    const jobCount = tag._count?.jobs ?? 0;
    const questionCount = tag._count?.questions ?? 0;
    const skillCount = tag._count?.skills ?? 0;

    if (jobCount > 0 || questionCount > 0 || skillCount > 0) {
      const links = [
        jobCount > 0 ? t("skills.jobsCount", { count: jobCount }) : "",
        questionCount > 0
          ? t("skills.questionsCount", { count: questionCount })
          : "",
        skillCount > 0 ? t("skills.skillsCount", { count: skillCount }) : "",
      ]
        .filter(Boolean)
        .join(` ${t("shared.and")} `);

      setAlert({
        openState: true,
        title: t("skills.inUseTitle"),
        description: t("skills.inUse", { links }),
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: tag.id,
      });
    }
  };

  const deleteTag = async (tagId: string | undefined) => {
    if (!tagId) return;
    const { success, message } = await deleteTagById(tagId);
    if (success) {
      toastSuccess(t("skills.deleted"));
      reloadTags();
    } else {
      toastError(message);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("skills.label")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("shared.value")}</TableHead>
            <TableHead>{t("skills.jobs")}</TableHead>
            <TableHead>{t("skills.questions")}</TableHead>
            <TableHead>{t("shared.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag: Tag) => (
            <TableRow key={tag.id}>
              <TableCell className="font-medium">{tag.label}</TableCell>
              <TableCell className="font-medium hidden sm:table-cell">
                {tag.value}
              </TableCell>
              <TableCell className="font-medium">
                {tag._count?.jobs ?? 0}
              </TableCell>
              <TableCell className="font-medium">
                {tag._count?.questions ?? 0}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">{t("shared.toggleMenu")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t("shared.actions")}</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onClick={() => onDeleteTag(tag)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      {t("shared.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={t("skills.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteTag(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default TagsTable;
