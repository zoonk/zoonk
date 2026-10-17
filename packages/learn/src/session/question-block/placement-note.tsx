"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StudyQuestion } from "../session-types";

/**
 * A placement question in the first week's sessions says what it's for: it fine-tunes where the
 * plan starts, and a miss is never saved as a mistake, so "I don't know yet" is a fine answer.
 */
export function PlacementNote({ question }: { question: StudyQuestion }) {
  const t = useExtracted();

  if (!question.placement) {
    return null;
  }

  return (
    <p
      className="text-muted-foreground flex items-start gap-1.5 text-xs font-medium"
      data-slot="placement-note"
    >
      <LineMarker>
        <CompassIcon aria-hidden="true" className="size-3.5" />
      </LineMarker>
      {t("Fine-tuning your plan. A miss here is never saved as a mistake.")}
    </p>
  );
}
