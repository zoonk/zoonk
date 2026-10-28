import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type ToolSet } from "ai";
import { getModelFamily } from "../../../_utils/model-family";
import { zoonkGateway } from "../../../gateway";

/** `native` is the model's own provider search; the others work with any model. */
export const RESEARCH_SEARCH_TOOLS = ["exa", "parallel", "perplexity", "native"] as const;

export type ResearchSearchTool = (typeof RESEARCH_SEARCH_TOOLS)[number];

const MAX_RESULTS = 8;
const MAX_CHARACTERS_PER_RESULT = 2000;
const MAX_NATIVE_SEARCHES = 5;

function buildNativeSearch(model: string): ToolSet {
  const provider = getModelFamily(model);

  if (provider === "openai") {
    return { web_search: openai.tools.webSearch({ searchContextSize: "medium" }) };
  }

  if (provider === "anthropic") {
    return { web_search: anthropic.tools.webSearch_20260318({ maxUses: MAX_NATIVE_SEARCHES }) };
  }

  if (provider === "google") {
    return { google_search: google.tools.googleSearch({}) };
  }

  throw new Error(`No built-in search for ${model}; use a gateway search tool.`);
}

/**
 * Domain filters are left to the model's tool calls: the prompt asks it to search the official
 * domains first.
 */
export function buildResearchSearchTools({
  model,
  searchTool,
}: {
  model: string;
  searchTool: ResearchSearchTool;
}): ToolSet {
  if (searchTool === "exa") {
    return {
      web_search: zoonkGateway.tools.exaSearch({
        contents: { text: { maxCharacters: MAX_CHARACTERS_PER_RESULT } },
        numResults: MAX_RESULTS,
      }),
    };
  }

  if (searchTool === "parallel") {
    return {
      web_search: zoonkGateway.tools.parallelSearch({
        excerpts: { maxCharsPerResult: MAX_CHARACTERS_PER_RESULT },
        maxResults: MAX_RESULTS,
        mode: "agentic",
      }),
    };
  }

  if (searchTool === "perplexity") {
    return { web_search: zoonkGateway.tools.perplexitySearch({ maxResults: MAX_RESULTS }) };
  }

  return buildNativeSearch(model);
}

const URL_PATTERN = /https?:\/\/[^\s"'<>\\)\]]+/gu;

function collectUrls(value: unknown): string[] {
  return JSON.stringify(value ?? null).match(URL_PATTERN) ?? [];
}

function getHostname(url: string): string | null {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : null;
}

/** A document on a site no search returned was invented, so callers drop it before fetching. */
export function collectSearchedHosts({
  sources,
  toolResults,
}: {
  sources: readonly unknown[];
  toolResults: readonly unknown[];
}): Set<string> {
  const urls = [...collectUrls(sources), ...collectUrls(toolResults)];

  return new Set(urls.map((url) => getHostname(url)).filter((host) => host !== null));
}

export function isOnSearchedHost({ hosts, url }: { hosts: Set<string>; url: string }): boolean {
  const hostname = getHostname(url);
  return hostname !== null && hosts.has(hostname);
}
