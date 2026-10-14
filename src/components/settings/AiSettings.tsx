"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AiModel,
  AiProvider,
  defaultModel,
  OpenaiModel,
  DeepseekModel,
  GeminiModel,
} from "@/models/ai.model";
import {
  PROVIDER_REGISTRY,
  AI_PROVIDERS,
} from "@/lib/ai/provider-registry";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { toastSuccess, toastError } from "@/lib/toast";
import { XCircle, Loader2, RefreshCw } from "lucide-react";
import { checkOllamaConnection } from "@/utils/ai.utils";
import { getUserSettings, updateAiSettings } from "@/actions/userSettings.actions";
import { useAgentChat } from "@/components/agent/AgentChatProvider";
import { useTranslations } from "@/i18n/client";

// Kept as data and worded when rendered, so a language switch rewords an
// error already on screen: the server's own text, or ours by provider kind.
type ModelsError = { text: string } | { local: boolean; provider: string };
type ConnectionError = { text?: string };

function AiSettings() {
  const t = useTranslations("settings");
  const { isOpen: isAgentChatOpen, refreshPreflight } = useAgentChat();
  const [selectedModel, setSelectedModel] = useState<AiModel>(defaultModel);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fetchError, setFetchError] = useState<ModelsError | null>(null);
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null);


  const setSelectedProvider = (provider: AiProvider) => {
    setSelectedModel({ provider, model: undefined });
    setFetchError(null);
    setConnectionError(null);
  };

  const setSelectedProviderModel = (model: string) => {
    setSelectedModel({ ...selectedModel, model });
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const settingsResult = await getUserSettings();

        if (settingsResult.success && settingsResult.data?.settings?.ai) {
          const aiSettings = settingsResult.data.settings.ai;
          setSelectedModel({
            provider: aiSettings.provider || defaultModel.provider,
            model: aiSettings.model,
          });
        }
      } catch (error) {
        console.error("Error fetching user settings:", error);
      } finally {
        setIsLoadingSettings(false);
        setIsInitialized(true);
      }
    };
    fetchSettings();
  }, []);

  const getFallbackModels = (provider: AiProvider): string[] => {
    switch (provider) {
      case AiProvider.OPENAI:
        return Object.values(OpenaiModel);
      case AiProvider.DEEPSEEK:
        return Object.values(DeepseekModel);
      case AiProvider.GEMINI:
        return Object.values(GeminiModel);
      default:
        return [];
    }
  };

  const fetchModelsForProvider = useCallback(
    (provider: AiProvider) => {
      const entry = PROVIDER_REGISTRY[provider];
      if (!entry) return () => {};

      if (!entry.modelsEndpoint) {
        const fallbackModels = getFallbackModels(provider);
        setFetchedModels(fallbackModels);
        setSelectedModel((prev) =>
          prev.model && !fallbackModels.includes(prev.model)
            ? { ...prev, model: undefined }
            : prev,
        );
        return () => {};
      }

      const fallback = getFallbackModels(provider);
      let cancelled = false;
      setIsLoadingModels(true);
      setFetchError(null);
      setConnectionError(null);

      (async () => {
        try {
          if (entry.category === "local") {
            const connResult = await checkOllamaConnection(provider);
            if (!connResult.isConnected) {
              if (!cancelled) {
                setFetchedModels(fallback);
                setConnectionError({ text: connResult.error || undefined });
              }
              return;
            }
          }
          const response = await fetch(`/api/ai/${entry.modelsEndpoint}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg: ModelsError = errorData?.error
              ? { text: errorData.error }
              : { local: entry.category === "local", provider: entry.displayName };
            if (!cancelled) {
              setFetchError(errorMsg);
              setFetchedModels(fallback);
            }
            return;
          }
          const data = await response.json();
          const models = entry.parseModelsResponse?.(data) ?? [];
          const finalModels = models.length > 0 ? models : fallback;
          if (!cancelled) {
            setFetchedModels(finalModels);
            setSelectedModel((prev) =>
              prev.model && !finalModels.includes(prev.model)
                ? { ...prev, model: undefined }
                : prev,
            );
          }
        } catch (error) {
          console.error(`Error fetching ${entry.displayName} models:`, error);
          if (!cancelled) {
            setFetchedModels(fallback);
            setFetchError({ local: entry.category === "local", provider: entry.displayName });
          }
        } finally {
          if (!cancelled) setIsLoadingModels(false);
        }
      })();

      return () => { cancelled = true; };
    },
    [],
  );

  useEffect(() => {
    if (!isInitialized) return;
    return fetchModelsForProvider(selectedModel.provider);
  }, [selectedModel.provider, isInitialized, fetchModelsForProvider]);

  const retryConnection = () => {
    fetchModelsForProvider(selectedModel.provider);
  };

  const saveModelSettings = async () => {
    if (!selectedModel.model) {
      toastError(t("ai.selectModel"));
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateAiSettings({
        provider: selectedModel.provider,
        model: selectedModel.model,
      });
      if (result.success) {
        toastSuccess(t("ai.saved"), t("ai.savedTitle"));
        if (isAgentChatOpen) void refreshPreflight();
      } else {
        toastError(result.message || t("ai.saveFailed"));
      }
    } catch (error) {
      console.error("Error saving AI settings:", error);
      toastError(t("ai.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  // Radix reads an undefined value as uncontrolled and falls back to its own
  // internal state, which still holds the previous provider's pick; a value
  // matching no item renders neither item text nor placeholder.
  const modelValue =
    selectedModel.model && fetchedModels.includes(selectedModel.model)
      ? selectedModel.model
      : "";

  const fetchErrorText =
    fetchError &&
    ("text" in fetchError
      ? fetchError.text
      : t(fetchError.local ? "ai.fetchFailedLocal" : "ai.fetchFailedKey", {
          provider: fetchError.provider,
        }));
  const connectionErrorText =
    connectionError && (connectionError.text || t("ai.ollamaUnreachable"));

  if (isLoadingSettings) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("ai.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("ai.description")}
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
        <h3 className="text-lg font-medium">{t("ai.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("ai.description")}
        </p>
      </div>
      <div>
        <Label className="my-4" htmlFor="ai-provider">
          {t("ai.providerLabel")}
        </Label>
        <Select
          value={selectedModel.provider}
          onValueChange={setSelectedProvider}
        >
          <SelectTrigger
            id="ai-provider"
            aria-label={t("ai.providerAriaLabel")}
            className="w-[180px]"
          >
            <SelectValue placeholder={t("ai.providerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {AI_PROVIDERS.map((id) => {
                const entry = PROVIDER_REGISTRY[id];
                return (
                  <SelectItem key={id} value={id}>
                    {entry.displayName}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="my-4" htmlFor="ai-model">
          {t("ai.modelLabel")}
        </Label>
        <div className="flex flex-wrap items-start gap-2">
          <Select
            value={isLoadingModels ? "" : modelValue}
            onValueChange={setSelectedProviderModel}
            disabled={isLoadingModels}
          >
            <SelectTrigger
              id="ai-model"
              aria-label={t("ai.modelAriaLabel")}
              className="w-[180px]"
            >
              {/* a flex row here must nest inside SelectValue's span, which the
                  trigger's [&>span]:line-clamp-1 outranks */}
              <SelectValue
                placeholder={
                  isLoadingModels ? (
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("ai.loadingModels")}
                    </span>
                  ) : (
                    t("ai.modelPlaceholder")
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fetchedModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {fetchErrorText && (
            <div className="flex items-start gap-1 text-red-600 text-sm mt-2">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{fetchErrorText}</span>
            </div>
          )}
          {connectionErrorText && (
            <div className="flex items-start gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 shrink-0 text-muted-foreground"
                onClick={retryConnection}
                disabled={isLoadingModels}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
                {t("ai.retry")}
              </Button>
              <div className="flex items-start gap-1 text-red-600 text-sm">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{connectionErrorText}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <Button
        className="mt-4"
        onClick={saveModelSettings}
        disabled={!selectedModel.model || isLoadingModels || isSaving}
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("save")}
      </Button>
    </div>
  );
}

export default AiSettings;
