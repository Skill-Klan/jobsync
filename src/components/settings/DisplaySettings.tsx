"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastError } from "@/lib/toast";
import { Button } from "../ui/button";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import {
  getUserSettings,
  updateDisplaySettings,
} from "@/actions/userSettings.actions";
import { useTranslations } from "@/i18n/client";

// Built per render: the message is in the user's language.
const appearanceFormSchema = (message: string) =>
  z.object({
    theme: z.enum(["light", "dark", "system"], {
      error: message,
    }),
  });

type AppearanceFormValues = z.infer<ReturnType<typeof appearanceFormSchema>>;

function DisplaySettings() {
  const t = useTranslations("settings");
  const { setTheme, theme, systemTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema(t("appearance.themeRequired"))),
    defaultValues: {
      theme: "system",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const result = await getUserSettings();
        if (result.success && result.data?.settings?.display?.theme) {
          const savedTheme = result.data.settings.display.theme;
          form.reset({ theme: savedTheme });
          setTheme(savedTheme);
        } else if (theme) {
          form.reset({ theme: theme as "light" | "dark" | "system" });
        }
      } catch (error) {
        console.error("Error fetching display settings:", error);
        if (theme) {
          form.reset({ theme: theme as "light" | "dark" | "system" });
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: AppearanceFormValues) {
    setIsSaving(true);
    try {
      const result = await updateDisplaySettings({ theme: data.theme });
      if (result.success) {
        setTheme(data.theme);
        toastSuccess(t("appearance.saved"));
      } else {
        toastError(result.message || t("appearance.saveFailed"));
      }
    } catch (error) {
      console.error("Error saving display settings:", error);
      toastError(t("appearance.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("appearance.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("appearance.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("loadingSettings")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{t("appearance.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appearance.description")}
        </p>
      </div>
      <div className="@container">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>{t("appearance.theme")}</FormLabel>
                  <FormDescription>
                    {t("appearance.themeDescription")}
                  </FormDescription>
                  <FormMessage />
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid max-w-lg @md:grid-cols-3 gap-8 pt-2"
                  >
                    <FormItem>
                      <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                        <FormControl>
                          <RadioGroupItem value="light" className="sr-only" />
                        </FormControl>
                        <LightThemeElement />
                        <span className="block w-full p-2 text-center font-normal">
                          {t("appearance.light")}
                        </span>
                      </FormLabel>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                        <FormControl>
                          <RadioGroupItem value="dark" className="sr-only" />
                        </FormControl>
                        <DarkThemeElement />
                        <span className="block w-full p-2 text-center font-normal">
                          {t("appearance.dark")}
                        </span>
                      </FormLabel>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                        <FormControl>
                          <RadioGroupItem value="system" className="sr-only" />
                        </FormControl>
                        {systemTheme === "dark" ? (
                          <DarkThemeElement />
                        ) : (
                          <LightThemeElement />
                        )}
                        <span className="block w-full p-2 text-center font-normal">
                          {t("appearance.system")}
                        </span>
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default DisplaySettings;

function LightThemeElement() {
  return (
    <div className="cursor-pointer items-center rounded-md border-2 border-muted p-1 hover:border-accent">
      <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
        <div className="space-y-2 rounded-md bg-white p-2 shadow-xs">
          <div className="h-2 w-4/5 rounded-lg bg-[#ecedef]" />
          <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-full rounded-lg bg-[#ecedef]" />
        </div>
      </div>
    </div>
  );
}
function DarkThemeElement() {
  return (
    <div className="cursor-pointer items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground">
      <div className="space-y-2 rounded-sm bg-slate-950 p-2">
        <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
          <div className="h-2 w-4/5 rounded-lg bg-slate-400" />
          <div className="h-2 w-full rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-full rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-full rounded-lg bg-slate-400" />
        </div>
      </div>
    </div>
  );
}
