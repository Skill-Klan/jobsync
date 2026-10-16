"use client";

import { BarChart3, Bot, Database, Key, Palette, ToggleRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/client";

export type SettingsSection =
  | "ai-provider"
  | "ai-usage"
  | "api-keys"
  | "appearance"
  | "data"
  | "features";

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: "aiProvider" | "aiUsage" | "apiKeys" | "appearance" | "data" | "features";
  icon: typeof Bot;
  adminOnly?: boolean;
}[] = [
  { id: "ai-provider", label: "aiProvider", icon: Bot },
  { id: "ai-usage", label: "aiUsage", icon: BarChart3 },
  { id: "api-keys", label: "apiKeys", icon: Key },
  { id: "appearance", label: "appearance", icon: Palette },
  { id: "data", label: "data", icon: Database },
  // The SkillKlan feature switches — admins only (owner 2026-10-16).
  { id: "features", label: "features", icon: ToggleRight, adminOnly: true },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showFeatures?: boolean;
}

export default function SettingsSidebar({
  activeSection,
  onSectionChange,
  showFeatures = false,
}: SettingsSidebarProps) {
  const t = useTranslations("settings.sections");
  return (
    <nav className="flex flex-col gap-1 w-10 sm:w-48 shrink-0">
      {SETTINGS_SECTIONS.filter((section) => !section.adminOnly || showFeatures).map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        const label = t(section.label);
        return (
          <Button
            key={section.id}
            variant="ghost"
            title={label}
            aria-label={label}
            className={cn(
              "justify-center sm:justify-start gap-2 rounded-none border-l-2 px-0 sm:px-4",
              isActive
                ? "border-l-primary bg-muted font-medium"
                : "border-l-transparent hover:border-l-muted-foreground/25",
            )}
            onClick={() => onSectionChange(section.id)}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
