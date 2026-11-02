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
