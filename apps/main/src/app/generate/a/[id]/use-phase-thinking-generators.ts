"use client";

import { type PhaseName } from "@/lib/generation/activity-generation-phase-config";
import { type ThinkingMessageGenerator } from "@/lib/workflow/use-thinking-messages";
import { useContentPhaseGenerators } from "./phase-thinking-generators/content";
import { useLanguagePhaseGenerators } from "./phase-thinking-generators/language";

/**
 * Returns thinking message generators for each phase.
 *
 * Each domain has its own file in the phase-thinking-generators/ folder.
 * This hook composes them.
 */
export function usePhaseThinkingGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  return {
    ...useLanguagePhaseGenerators(),
    ...useContentPhaseGenerators(),
  };
}
