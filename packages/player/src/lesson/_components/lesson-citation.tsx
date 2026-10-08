"use client";

import { type LessonStepCitation } from "@zoonk/core/lesson-player/contract";
import { SourcesChip } from "@zoonk/learn/sources-chip";
import { FileQuestionIcon, FileTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../../components/step-layouts";

type MaterialStepCitation = Extract<LessonStepCitation, { kind: "material" }>;

function useCitationLabel() {
  const t = useExtracted();

  return (citation: MaterialStepCitation): string => {
    const { page, title } = citation;

    if (page === null) {
      return title;
    }

    return citation.unit === "slide"
      ? t("{title}, slide {page}", { page: String(page), title })
      : t("{title}, page {page}", { page: String(page), title });
  };
}

/** "Aula 5, slide 4": the page of the learner's own material, so they can open it there. */
function MaterialCitation({ citation }: { citation: MaterialStepCitation }) {
  const t = useExtracted();
  const label = useCitationLabel()(citation);

  return (
    <p
      aria-label={t("From your material: {source}", { source: label })}
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
    >
      <FileTextIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </p>
  );
}

/**
 * An explanation in a lesson built from the learner's material that no page of it supports: it
 * says so, so the learner doesn't take it for something their class covered.
 */
function NotInMaterial() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <FileQuestionIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {t("Not in your material")}
    </p>
  );
}

function CitationByKind({ citation }: { citation: LessonStepCitation }) {
  switch (citation.kind) {
    case "material":
      return <MaterialCitation citation={citation} />;
    case "source":
      return <SourcesChip citation={citation} />;
    case "notInMaterial":
      return <NotInMaterial />;
    default:
      return null;
  }
}

/**
 * Where a screen comes from: the page of the learner's own material for lessons built from it, the
 * dated Sources chip for screens whose facts come from a public document, or that an explanation
 * isn't in the learner's material.
 */
export function LessonCitation({ citation }: { citation: LessonStepCitation | null }) {
  if (!citation) {
    return null;
  }

  return (
    <PlayerContentFrame className="pt-6 pb-2">
      <CitationByKind citation={citation} />
    </PlayerContentFrame>
  );
}
