"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactRole } from "@/models/contact.model";
import { useLabel, useTranslations } from "@/i18n/client";

// Select cannot hold an empty-string value, so all-roles gets a sentinel
const ALL = "all";

type Props = {
  roles: ContactRole[];
  roleId?: string;
  onRoleChange: (roleId?: string) => void;
};

export function ContactRoleFilter({ roles, roleId, onRoleChange }: Props) {
  const t = useTranslations("library");
  const label = useLabel();
  return (
    <Select
      value={roleId ?? ALL}
      onValueChange={(v) => onRoleChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger aria-label={t("contacts.filterAria")} className="h-8 w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("contacts.allRoles")}</SelectItem>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {label("contactRole", role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
