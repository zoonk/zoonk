"use client";

import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { useMemo } from "react";
import { type PluginConfig } from "streamdown";

/** Math in an answer: Streamdown's math plugin reads `$$…$$` only, so single dollars stay text. */
function needsMath(text: string): boolean {
  return text.includes("$$");
}

const MERMAID_FENCE = /(?:`{3,}|~{3,})[ \t]*mermaid/iu;

function needsMermaid(text: string): boolean {
  return MERMAID_FENCE.test(text);
}

const mathPlugin = createOnDemand(() => import("@streamdown/math").then(({ math }) => math));

const mermaidPlugin = createOnDemand(() =>
  import("@streamdown/mermaid").then(({ mermaid }) => mermaid),
);

export function preloadMarkdownPlugins(texts: readonly string[]) {
  if (texts.some((text) => needsMath(text))) {
    void mathPlugin.load();
  }

  if (texts.some((text) => needsMermaid(text))) {
    void mermaidPlugin.load();
  }
}

export function useMarkdownPlugins({
  isStreaming,
  text,
}: {
  isStreaming: boolean;
  text: string;
}): PluginConfig {
  const wait = isStreaming ? false : undefined;
  const math = mathPlugin.useModule({ enabled: needsMath(text), wait });
  const mermaid = mermaidPlugin.useModule({ enabled: needsMermaid(text), wait });

  return useMemo(() => ({ ...(math && { math }), ...(mermaid && { mermaid }) }), [math, mermaid]);
}
