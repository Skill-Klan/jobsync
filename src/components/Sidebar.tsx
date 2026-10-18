"use client";
import Link from "next/link";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Briefcase, CornerUpLeft } from "lucide-react";
import { APP_CONSTANTS, visibleSidebarLinks } from "@/lib/constants";
import { useFeatures } from "@/context/FeaturesContext";
import NavLink from "./NavLink";
import { ProfileDropdown } from "./ProfileDropdown";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";
import { CurrentUser } from "@/models/user.model";
import { useTranslations } from "@/i18n/client";

interface SidebarProps {
  user: CurrentUser | null;
  signOutAction: () => void;
  // D72: back to the cabinet — its address from the server (cabinetLink), null → no item.
  cabinetUrl?: string | null;
}

function Sidebar({ user, signOutAction, cabinetUrl = null }: SidebarProps) {
  const path = usePathname();
  const { expanded } = useSidebar();
  const t = useTranslations("nav");
  const features = useFeatures();
  const isOnDashboard = path === "/dashboard";

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        id={APP_CONSTANTS.SIDEBAR_DOM_ID}
        className={cn(
          "fixed inset-y-0 left-0 z-10 hidden flex-col border-r bg-background transition-[width] duration-200 ease-in-out sm:flex",
          expanded
            ? APP_CONSTANTS.SIDEBAR_WIDTH.expanded.rail
            : APP_CONSTANTS.SIDEBAR_WIDTH.collapsed.rail,
        )}
      >
        <div className="flex h-14 shrink-0 items-center overflow-hidden sm:mt-2">
          <div className="flex w-14 shrink-0 items-center justify-center">
            <Link
              href="/dashboard"
              aria-current={isOnDashboard ? "page" : undefined}
              onClick={(e) => {
                if (isOnDashboard) e.preventDefault();
              }}
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:h-8 md:w-8"
            >
              <Briefcase className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="sr-only">SkillKlan Job</span>
            </Link>
          </div>
          <span
            className={cn(
              "truncate font-semibold transition-opacity duration-200",
              expanded ? "opacity-100 delay-100" : "opacity-0",
            )}
          >
            SkillKlan Job
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
          {visibleSidebarLinks(features).map((item) => {
            return (
              <NavLink
                key={item.route}
                label={t(item.labelKey)}
                Icon={item.icon}
                route={item.route}
                pathname={path}
                expanded={expanded}
              />
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t py-2">
          {cabinetUrl && (
            <NavLink
              label={t("cabinet")}
              Icon={CornerUpLeft}
              route={cabinetUrl}
              pathname={path}
              expanded={expanded}
            />
          )}
          <ProfileDropdown
            user={user}
            expanded={expanded}
            signOutAction={signOutAction}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}

export default Sidebar;
