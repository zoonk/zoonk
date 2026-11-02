"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ScrollTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StudyQuestion } from "../session-types";

/** Past exam questions are only copied where their organizer allows it with the source cited. */
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
