"use client";

import { useState } from "react";
import AiSettings from "@/components/settings/AiSettings";
import AiUsageSettings from "@/components/settings/AiUsageSettings";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import DataSettings from "@/components/settings/DataSettings";
import DisplaySettings from "@/components/settings/DisplaySettings";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";
import { useTranslations } from "@/i18n/client";

function Settings() {
  const t = useTranslations("settings");
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai-provider");

  return (
    <div className="flex flex-col col-span-3">
      <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
        {t("page.title")}
      </h3>
      <div className="flex gap-3 sm:gap-6">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className="flex-1 min-w-0">
          {activeSection === "ai-provider" && <AiSettings />}
          {activeSection === "ai-usage" && <AiUsageSettings />}
          {activeSection === "api-keys" && <ApiKeySettings />}
          {activeSection === "appearance" && <DisplaySettings />}
          {activeSection === "data" && <DataSettings />}
        </div>
      </div>
    </div>
  );
}

export default Settings;
