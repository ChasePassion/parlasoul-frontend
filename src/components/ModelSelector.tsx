"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Check, Loader2, AlertCircle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getLLMModelCatalog, searchLLMModels } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-map";
import {
  groupModelsByProvider,
  type ModelGroup,
  type ModelDisplayInfo,
} from "@/lib/llm-adapter";
import type { LLMProvider, CharacterLLMRoute } from "@/lib/api-service";

function getProviderIconPath(provider: LLMProvider): string {
  return `/llm-provider/${provider}-favicon.ico`;
}

function getProviderLabel(provider: LLMProvider): string {
  const labels: Record<LLMProvider, string> = {
    deepseek: "DeepSeek",
    openrouter: "OpenRouter",
    xiaomi: "Xiaomi MiMo",
  };
  return labels[provider] || provider;
}

interface ModelSelectorProps {
  selectedProvider: LLMProvider | null | undefined;
  selectedModel: string | null | undefined;
  onSelectModel: (provider: LLMProvider, model: string) => void;
  onSelectSystemDefault: () => void;
  disabled?: boolean;
}

type FetchState = "idle" | "loading" | "success" | "error";

export default function ModelSelector({
  selectedProvider,
  selectedModel,
  onSelectModel,
  onSelectSystemDefault,
  disabled = false,
}: ModelSelectorProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [defaultRoute, setDefaultRoute] = useState<CharacterLLMRoute | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ModelDisplayInfo[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [collapsedProviders, setCollapsedProviders] = useState<Set<LLMProvider>>(new Set());
  const searchRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadModels = useCallback(async () => {
    setFetchState("loading");
    setError(null);

    try {
      const response = await getLLMModelCatalog();
      const groups = groupModelsByProvider(response.items);
      setModelGroups(groups);
      setDefaultRoute(response.default_route);
      setCollapsedProviders(new Set(groups.map((g) => g.provider)));
      setFetchState("success");
    } catch (err) {
      setError(getErrorMessage(err));
      setFetchState("error");
    }
  }, []);

  useEffect(() => {
    if (!disabled) {
      loadModels();
    }
  }, [loadModels, disabled]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        searchRequestIdRef.current += 1;
        setSearchQuery("");
        setSearchResults(null);
        setIsSearching(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleProvider = (provider: LLMProvider) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    const normalizedQuery = query.trim();
    const requestId = ++searchRequestIdRef.current;

    if (!normalizedQuery) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchLLMModels(normalizedQuery);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setSearchResults(response.items.map((item) => ({
        id: `${item.provider}:${item.model}`,
        provider: item.provider,
        model: item.model,
        label: item.label,
        description: item.description || "",
        isDefault: item.is_default,
      })));
    } catch {
      if (requestId === searchRequestIdRef.current) {
        setSearchResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSelectModel = (provider: LLMProvider, model: string) => {
    searchRequestIdRef.current += 1;
    onSelectModel(provider, model);
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleSelectSystemDefault = () => {
    searchRequestIdRef.current += 1;
    onSelectSystemDefault();
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults(null);
  };

  const getCurrentSelection = (): { label: string } | null => {
    if (selectedProvider === null || selectedProvider === undefined) {
      return { label: "系统默认模型" };
    }

    if (selectedProvider && selectedModel) {
      for (const group of modelGroups) {
        const found = group.models.find(
          (m) => m.provider === selectedProvider && m.model === selectedModel
        );
        if (found) {
          return { label: found.label };
        }
      }

      return {
        label: `${getProviderLabel(selectedProvider)} · ${selectedModel}`,
      };
    }

    return { label: "系统默认模型" };
  };

  if (disabled) {
    return null;
  }

  if (fetchState === "loading") {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">加载模型列表...</span>
      </div>
    );
  }

  if (fetchState === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error || "服务器内部错误，请重试"}</span>
        </div>
        <button
          type="button"
          onClick={loadModels}
          className="p-1 hover:bg-red-100 rounded-md transition-colors"
        >
          <Image
            src="/icons/refresh-ec66f0.svg"
            alt="重试"
            width={20}
            height={20}
            className="text-red-600"
          />
        </button>
      </div>
    );
  }

  if (fetchState === "success" && modelGroups.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">暂无可用模型</p>
      </div>
    );
  }

  const currentSelection = defaultRoute ? getCurrentSelection() : null;
  const isSystemDefaultSelected = selectedProvider === null || selectedProvider === undefined;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          isOpen
            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">
            {currentSelection?.label || "选择模型"}
          </p>
        </div>
        <Image
          src="/icons/chevron-left-8ee2e9.svg"
          alt=""
          width={20}
          height={20}
          className={`text-gray-400 transition-transform ${isOpen ? "-rotate-90" : "rotate-180"}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="搜索模型..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-9 h-10 bg-gray-50 border-gray-200 focus-visible:ring-0 focus-visible:!border-gray-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    searchRequestIdRef.current += 1;
                    setSearchQuery("");
                    setSearchResults(null);
                    setIsSearching(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {searchQuery && searchResults !== null ? (
              searchResults.length > 0 ? (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium text-gray-500">搜索结果</p>
                  {searchResults.map((model) => {
                    const isSelected = selectedProvider === model.provider && selectedModel === model.model;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectModel(model.provider, model.model)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={getProviderIconPath(model.provider)}
                            alt={model.provider}
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">{model.label}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">未找到匹配的模型</div>
              )
            ) : (
              <div className="p-2">
                <button
                  type="button"
                  onClick={handleSelectSystemDefault}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mt-2 ${
                    isSystemDefaultSelected ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gray-100">
                    {defaultRoute ? (
                      <Image
                        src={getProviderIconPath(defaultRoute.provider)}
                        alt={defaultRoute.provider}
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-lg">⚙️</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">系统默认模型</p>
                  </div>
                  {isSystemDefaultSelected && <Check className="h-4 w-4 text-blue-600" />}
                </button>

                {modelGroups.map((group) => {
                  const isCollapsed = collapsedProviders.has(group.provider);
                  const hasSelectedModel = group.models.some(
                    (m) => m.provider === selectedProvider && m.model === selectedModel
                  );
                  return (
                    <div key={group.provider} className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleProvider(group.provider)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          hasSelectedModel
                            ? "bg-blue-50 border border-blue-500"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={getProviderIconPath(group.provider)}
                            alt={group.provider}
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-medium ${hasSelectedModel ? "text-blue-700" : "text-gray-900"}`}>{group.label}</p>
                        </div>
                        <span className="text-xs text-gray-500 mr-2">{group.models.length} 个模型</span>
                        <Image
                          src="/icons/chevron-left-8ee2e9.svg"
                          alt=""
                          width={16}
                          height={16}
                          className={`text-gray-400 transition-transform ${isCollapsed ? "-rotate-180" : "-rotate-90"}`}
                        />
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-1">
                          {group.models.map((model) => {
                            const isSelected = selectedProvider === model.provider && selectedModel === model.model;
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => handleSelectModel(model.provider, model.model)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all pl-[55px] ${
                                  isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex-1 text-left">
                                  <p className="text-sm font-medium text-gray-900">{model.label}</p>
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
