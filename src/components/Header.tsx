import Link from "next/link";
import { PanelLeft, Briefcase, CornerUpLeft, PowerIcon, Settings } from "lucide-react";

import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { visibleSidebarLinks } from "@/lib/constants";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { cabinetLink } from "@/skillklan/cabinetLink";
import { isAdminSession } from "@/skillklan/cabinetAdmin";
import SidebarToggle from "./SidebarToggle";
import { AgentChatTrigger } from "./AgentChatTrigger";
import { NotificationBell } from "./notifications/NotificationBell";
import { LocaleButtons } from "./LocaleSwitcher";
import { OnboardingReplayButton } from "./onboarding/OnboardingProvider";
import { getTranslations } from "@/i18n/server";

// On a phone the side menu is hidden, and with it the user menu (avatar →
// Settings, language, sign out). The phone menu carries those three too
// (owner 2026-11-20): without them an admin could not reach «Функції», and
// nobody could switch the language or sign out.
async function Header({ signOutAction }: { signOutAction?: () => Promise<void> } = {}) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const ta = await getTranslations("account");
  const features = await getFeatureFlags();
  const isAdmin = await isAdminSession();
  const cabinetUrl = cabinetLink();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">{tc("toggleMenu")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <SheetTitle className="sr-only">{tc("navigationMenu")}</SheetTitle>
          <nav className="grid gap-6 text-lg font-medium">
            <SheetClose asChild>
              <Link
                href="/dashboard"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              >
                <Briefcase className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">SkillKlan Job</span>
              </Link>
            </SheetClose>
            {visibleSidebarLinks(features, undefined, isAdmin).map((item) => {
              return (
                <SheetClose asChild key={item.route}>
                  <Link
                    href={item.route}
                    className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {t(item.labelKey)}
                  </Link>
                </SheetClose>
              );
            })}
            {/* D72: back to the cabinet, in this same tab. */}
            {cabinetUrl && (
              <SheetClose asChild>
                <a
                  href={cabinetUrl}
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <CornerUpLeft className="h-5 w-5" />
                  {t("cabinet")}
                </a>
              </SheetClose>
            )}
            <div className="grid gap-6 border-t pt-6">
              <SheetClose asChild>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                  {ta("settings")}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <OnboardingReplayButton className="flex w-full items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground" />
              </SheetClose>
              <LocaleButtons className="px-2.5" />
              {signOutAction && (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <PowerIcon className="h-5 w-5" />
                    {ta("logout")}
                  </button>
                </form>
              )}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
      <SidebarToggle />
      <h1 className="font-semibold">
        SkillKlan Job<span className="hidden sm:inline"> - {tc("appSubtitle")}</span>
      </h1>
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="search"
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
        /> */}
      </div>

      {/* Every notification is about an automation run (D75). */}
      {features.automations && <NotificationBell />}
      <AgentChatTrigger />
    </header>
  );
}

export default Header;
