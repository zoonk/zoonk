"use client";

import { Button } from "@zoonk/ui/components/button";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { QuestionEyebrow } from "../../_components/question-title";
import { ChangeSaveError } from "../../_components/save-error";
import { useSentenceSpace } from "../../_utils/locale";
import { type StudyQuestion } from "../session-types";

/** `onSkipToday` resolves to whether today's test questions were taken out of the session. */
export function PlacementNote({
  onSkipToday,
  question,
}: {
  onSkipToday?: () => Promise<boolean>;
  question: StudyQuestion;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!question.placement) {
    return null;
  }

  const skipToday = () =>
    startTransition(async () => {
      const saved = (await onSkipToday?.().catch(() => false)) ?? false;
      setFailed(!saved);
    });

  return (
    <div className="flex flex-col gap-1" data-slot="placement-note">
      <QuestionEyebrow icon={<CompassIcon aria-hidden="true" />}>
        {t("Checking what you already know.")}
        {onSkipToday && (
          <>
            {space}
            <Button busy={isPending} onClick={skipToday} variant="link">
              {t("Not today")}
            </Button>
          </>
        )}
      </QuestionEyebrow>

      {failed && <ChangeSaveError className="ps-5 text-xs" />}
    </div>
  );
}
