"use client";

import { ScrollTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../../_components/eyebrow";
import { type StudyQuestion } from "../session-types";

/** Past exam questions are only copied where their organizer allows it with the source cited. */
export function QuotedSource({ question }: { question: StudyQuestion }) {
  const t = useExtracted();

  if (!question.quoted || !question.citation) {
    return null;
  }

  return (
    <Eyebrow data-slot="quoted-source" icon={<ScrollTextIcon aria-hidden="true" />}>
      {t("Past exam question · {source}", { source: question.citation.text })}
    </Eyebrow>
  );
}
