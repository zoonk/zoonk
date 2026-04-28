"use client";

import { type PhaseName } from "@/lib/generation/lesson-generation-phase-config";
import { type ThinkingMessageGenerator } from "@/lib/workflow/use-thinking-messages";
import { useContentPhaseGenerators } from "./phase-thinking-generators/content";
import { useLanguagePhaseGenerators } from "./phase-thinking-generators/language";

/** Combines content and language thinking messages for lesson generation phases. */
export function usePhaseThinkingGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  return {
    ...useLanguagePhaseGenerators(),
    ...useContentPhaseGenerators(),
  };
}
