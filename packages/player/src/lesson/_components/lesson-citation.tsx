"use client";

import { type LessonStepCitation } from "@zoonk/core/lesson-player/contract";
import { useCitationLabel } from "@zoonk/learn/citation-label";
import { SourcesChip } from "@zoonk/learn/sources-chip";
import { FileQuestionIcon, FileTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../../components/step-layouts";

type MaterialStepCitation = Extract<LessonStepCitation, { kind: "material" }>;

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
