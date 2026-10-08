"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ScrollTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StudyQuestion } from "../session-types";

/**
 * Where a real past exam question comes from ("Enem 2022, 2º dia, questão 141"), shown with the
 * question before it's answered: questions are only copied where their organizer allows it with
 * the source cited. Written questions show nothing here.
 */
export function QuotedSource({ question }: { question: StudyQuestion }) {
  const t = useExtracted();

  if (!question.quoted || !question.citation) {
    return null;
  }

  return (
    <p
      className="text-muted-foreground flex items-start gap-1.5 text-xs font-medium"
      data-slot="quoted-source"
    >
      <LineMarker>
        <ScrollTextIcon aria-hidden="true" className="size-3.5" />
      </LineMarker>
      {t("Past exam question · {source}", { source: question.citation.text })}
    </p>
  );
}
