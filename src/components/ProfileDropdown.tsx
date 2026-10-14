"use client";

import { useState } from "react";
import Link from "next/link";
import { PowerIcon, Settings, Info, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import UserAvatar from "./UserAvatar";
import { SupportDialog } from "./SupportDialog";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/client";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface ProfileDropdownProps {
  user: any;
  expanded: boolean;
  signOutAction: () => void;
}

export function ProfileDropdown({
  user,
  expanded,
  signOutAction,
}: ProfileDropdownProps) {
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const { summary } = useNotifications();
  const t = useTranslations("account");
  // Name first: people signed in from the cabinet carry a placeholder email
  // (src/skillklan/cabinetUser.ts) that means nothing to them.
  const label = user?.name || user?.email || t("myAccount");

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("userMenu")}
                className="navlink h-10 w-full text-muted-foreground hover:text-foreground"
              >
                <span className="relative flex h-full w-14 shrink-0 items-center justify-center">
                  <UserAvatar user={user} />
                  {summary.unread > 0 && (
                    <>
                      <span
                        aria-hidden
                        data-testid="avatar-dot"
                        className={cn(
                          "absolute right-3 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                          summary.unreadErrors > 0 ? "bg-destructive" : "bg-primary"
                        )}
                      />
                      <span className="sr-only">{t("unreadNotifications")}</span>
                    </>
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-sm transition-opacity duration-200",
                    expanded ? "opacity-100 delay-100" : "opacity-0"
                  )}
                >
                  {label}
                </span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {!expanded && <TooltipContent side="right">{label}</TooltipContent>}
        </Tooltip>
        <DropdownMenuContent side="right" align="end">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="cursor-pointer">
              <Settings className="w-5 mr-2" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/notifications" className="cursor-pointer">
              <Bell className="w-5 mr-2" />
              <span className="flex-1">{t("notifications")}</span>
              {summary.unread > 0 && (
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 text-[11px] font-semibold text-white",
                    summary.unreadErrors > 0 ? "bg-destructive" : "bg-primary"
                  )}
                >
                  {summary.unread}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSupportDialogOpen(true)}
            className="cursor-pointer"
          >
            <Info className="w-5 mr-2" />
            {t("support")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <LocaleSwitcher />
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <form action={signOutAction}>
              <button type="submit" className="flex w-full items-center">
                <PowerIcon className="w-5 mr-2" />
                <div className="hidden md:block">{t("logout")}</div>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SupportDialog
        open={supportDialogOpen}
        onOpenChange={setSupportDialogOpen}
      />
    </>
  );
}
