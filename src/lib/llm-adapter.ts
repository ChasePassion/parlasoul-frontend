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

const PROVIDER_SEARCH_ALIASES: Record<LLMProvider, string[]> = {
  deepseek: ["deepseek", "deep seek", "ds", "深度求索"],
  openrouter: ["openrouter", "open router", "or"],
  xiaomi: ["xiaomi", "mi", "mimo", "mi mo", "小米", "小米mimo"],
};

const MAX_LOCAL_SEARCH_RESULTS = 50;

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

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[./:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ") : [];
}

function applyFieldWeight(score: number, weight: number): number {
  return score < 0 ? -1 : score + weight;
}

function scoreFieldMatch(fieldValue: string, query: string, queryTokens: string[]): number {
  const normalizedField = normalizeSearchText(fieldValue);
  if (!normalizedField) {
    return -1;
  }

  const compactField = compactSearchText(fieldValue);
  const compactQuery = compactSearchText(query);
  const fieldTokens = tokenizeSearchText(fieldValue);

  if (normalizedField === query || compactField === compactQuery) {
    return 1000;
  }

  if (normalizedField.startsWith(query) || compactField.startsWith(compactQuery)) {
    return 800;
  }

  const isTokenPrefixMatch =
    queryTokens.length > 0 &&
    queryTokens.every((queryToken) =>
      fieldTokens.some((fieldToken) => fieldToken.startsWith(queryToken))
    );

  if (isTokenPrefixMatch) {
    return 650;
  }

  const isTokenInclusionMatch =
    queryTokens.length > 0 &&
    queryTokens.every(
      (queryToken) =>
        normalizedField.includes(queryToken) || compactField.includes(queryToken)
    );

  if (isTokenInclusionMatch) {
    return 500;
  }

  if (normalizedField.includes(query) || compactField.includes(compactQuery)) {
    return 400;
  }

  return -1;
}

export function searchModelsByQuery(
  groups: ModelGroup[],
  query: string
): ModelDisplayInfo[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenizeSearchText(query);
  const scoredModels: Array<{
    model: ModelDisplayInfo;
    score: number;
    providerLabel: string;
  }> = [];

  for (const group of groups) {
    const providerLabel = getProviderLabel(group.provider);
    const providerSearchTerms = [providerLabel, group.provider, ...PROVIDER_SEARCH_ALIASES[group.provider]];

    for (const model of group.models) {
      const combinedText = [
        model.label,
        model.model,
        providerLabel,
        group.provider,
        model.description,
      ]
        .filter(Boolean)
        .join(" ");

      const score = Math.max(
        applyFieldWeight(
          scoreFieldMatch(model.label, normalizedQuery, queryTokens),
          300
        ),
        applyFieldWeight(
          scoreFieldMatch(model.model, normalizedQuery, queryTokens),
          250
        ),
        Math.max(
          ...providerSearchTerms.map(
            (term) =>
              applyFieldWeight(
                scoreFieldMatch(term, normalizedQuery, queryTokens),
                180
              )
          )
        ),
        applyFieldWeight(
          scoreFieldMatch(model.description, normalizedQuery, queryTokens),
          120
        ),
        scoreFieldMatch(combinedText, normalizedQuery, queryTokens)
      );

      if (score >= 0) {
        scoredModels.push({
          model,
          score,
          providerLabel,
        });
      }
    }
  }

  scoredModels.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.model.isDefault !== right.model.isDefault) {
      return left.model.isDefault ? -1 : 1;
    }

    const providerCompare = left.providerLabel.localeCompare(right.providerLabel, "en", {
      sensitivity: "base",
    });
    if (providerCompare !== 0) {
      return providerCompare;
    }

    return left.model.label.localeCompare(right.model.label, "en", {
      sensitivity: "base",
    });
  });

  return scoredModels
    .slice(0, MAX_LOCAL_SEARCH_RESULTS)
    .map(({ model }) => model);
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
