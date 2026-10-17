"use client";

import { FileClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  Suggestion,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionSummary,
} from "../_components/suggestion";

/**
 * A source the goal is built on changed, such as a corrected exam notice or an amended law: one
 * line on Today, "The exam notice changed: the test now has 60 questions." It's news, not a
 * question, so there's nothing to answer and the line says all of it; it leaves Today after two
 * weeks.
 */
export function TodayChangeNotice({ message }: { message: string }) {
  const t = useExtracted();

  return (
    <Suggestion data-slot="change-notice" label={t("What changed")} mark={<FileClockIcon />}>
      <SuggestionLine>
        <SuggestionSummary className="text-foreground line-clamp-none">{message}</SuggestionSummary>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{t("What changed")}</SuggestionHeader>
        <SuggestionDescription className="text-foreground">{message}</SuggestionDescription>
      </SuggestionContent>
    </Suggestion>
  );
}
