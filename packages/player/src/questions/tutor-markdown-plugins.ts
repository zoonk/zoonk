"use client";

import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { useMemo } from "react";
import { type PluginConfig } from "streamdown";

/** Math in an answer: Streamdown's math plugin reads `$$…$$` only, so single dollars stay text. */
function needsMath(text: string): boolean {
  return text.includes("$$");
}

/** A diagram in an answer: a code fence (indented in a list too) whose language is `mermaid`. */
const MERMAID_FENCE = /(?:`{3,}|~{3,})[ \t]*mermaid/iu;

function needsMermaid(text: string): boolean {
  return MERMAID_FENCE.test(text);
}

/** KaTeX and its Markdown syntax, loaded the first time an answer has math. */
const mathPlugin = createOnDemand(() => import("@streamdown/math").then(({ math }) => math));

/** Mermaid, loaded the first time an answer draws a diagram. */
const mermaidPlugin = createOnDemand(() =>
  import("@streamdown/mermaid").then(({ mermaid }) => mermaid),
);

/** Starts loading what these answers will need to be drawn (math, diagrams), before they show. */
export function preloadMarkdownPlugins(texts: readonly string[]) {
  if (texts.some((text) => needsMath(text))) {
    void mathPlugin.load();
  }

  if (texts.some((text) => needsMermaid(text))) {
    void mermaidPlugin.load();
  }
}

/**
 * The plugins an answer needs, loaded the first time one does, so most answers never download
 * KaTeX or Mermaid. A finished answer waits for them where the page can (`createOnDemand`); an
 * answer still streaming draws without one until it arrives, loading it from the opening `$$` or
 * fence, well before the formula or diagram closes.
 */
export function useMarkdownPlugins({
  isStreaming,
  text,
}: {
  isStreaming: boolean;
  text: string;
}): PluginConfig {
  // A streaming answer never waits; a finished one waits where the page can.
  const wait = isStreaming ? false : undefined;
  const math = mathPlugin.useModule({ enabled: needsMath(text), wait });
  const mermaid = mermaidPlugin.useModule({ enabled: needsMermaid(text), wait });

  return useMemo(() => ({ ...(math && { math }), ...(mermaid && { mermaid }) }), [math, mermaid]);
}
