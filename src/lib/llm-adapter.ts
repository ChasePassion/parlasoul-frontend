import type {
  LLMProvider,
  LLMModelCatalogItem,
  CharacterLLMRoute,
} from "./api-service";

export interface ModelDisplayInfo {
  id: string;
  provider: LLMProvider;
  model: string;
  label: string;
  description: string;
  isDefault: boolean;
}

export interface ModelGroup {
  label: string;
  provider: LLMProvider;
  models: ModelDisplayInfo[];
}

export function mapModelToDisplay(item: LLMModelCatalogItem): ModelDisplayInfo {
  return {
    id: `${item.provider}:${item.model}`,
    provider: item.provider,
    model: item.model,
    label: item.label,
    description: item.description || "",
    isDefault: item.is_default,
  };
}

export function getProviderLabel(provider: LLMProvider): string {
  const providerLabels: Record<LLMProvider, string> = {
    deepseek: "DeepSeek",
    openrouter: "OpenRouter",
    xiaomi: "Xiaomi MiMo",
  };
  return providerLabels[provider] || provider;
}

export function groupModelsByProvider(
  items: LLMModelCatalogItem[]
): ModelGroup[] {
  const providerMap = new Map<LLMProvider, ModelDisplayInfo[]>();

  for (const item of items) {
    const display = mapModelToDisplay(item);
    if (!providerMap.has(item.provider)) {
      providerMap.set(item.provider, []);
    }
    providerMap.get(item.provider)!.push(display);
  }

  const groups: ModelGroup[] = [];
  providerMap.forEach((models, provider) => {
    groups.push({
      label: getProviderLabel(provider),
      provider,
      models,
    });
  });

  groups.sort((a, b) => {
    return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });

  return groups;
}

export function isSystemDefaultRoute(
  provider: LLMProvider | null | undefined,
  model: string | null | undefined,
  defaultRoute: CharacterLLMRoute
): boolean {
  if (provider === null || provider === undefined) return true;
  if (model === null || model === undefined) return true;
  return provider === defaultRoute.provider && model === defaultRoute.model;
}

export function createSystemDefaultDisplay(
  defaultRoute: CharacterLLMRoute
): ModelDisplayInfo {
  return {
    id: "system-default",
    provider: defaultRoute.provider,
    model: defaultRoute.model,
    label: "系统默认模型",
    description: `${getProviderLabel(defaultRoute.provider)} ${defaultRoute.model}`,
    isDefault: true,
  };
}
