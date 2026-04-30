"use client";

import { type ThinkingMessageGenerator } from "@/lib/workflow/use-thinking-messages";
import { type PhaseName } from "./generation-phase-config";
import { useContentPhaseGenerators } from "./phase-thinking-generators/content";
import { useLanguagePhaseGenerators } from "./phase-thinking-generators/language";

/** Combines content and language thinking messages for lesson generation phases. */
export function usePhaseThinkingGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  return {
    ...useLanguagePhaseGenerators(),
    ...useContentPhaseGenerators(),
  };
}
