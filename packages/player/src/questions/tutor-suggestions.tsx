"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { getQuestionLimit } from "./lesson-question-errors";
import { useLessonQuestionController } from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";

/** A question on its way, or lost and sent again before anything new, leaves a suggestion nothing to do. */
export function useOffersSuggestions(): boolean {
  const { state, unresolvedQuestion } = useLessonQuestionController();
  return !getQuestionLimit(state) && state.creating === null && unresolvedQuestion === null;
}

/** Rows 36px tall with an 8px gap keep each 44px hit area out of its neighbor's. */
export function TutorSuggestions({
  className,
  onSelect,
  suggestions,
}: {
  className?: string;
  onSelect: (suggestion: OfferedSuggestion) => void;
  suggestions: readonly OfferedSuggestion[];
}) {
  const t = useExtracted();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <ul aria-label={t("Suggested questions")} className={cn("flex flex-wrap gap-2", className)}>
      {suggestions.map((suggestion) => (
        <li className="min-w-0" key={suggestion.question}>
          <Button
            className="bg-background h-auto min-h-9 max-w-full py-1.5 text-left whitespace-normal"
            onClick={() => onSelect(suggestion)}
            type="button"
            variant="outline"
          >
            {suggestion.question}
          </Button>
        </li>
      ))}
    </ul>
  );
}
