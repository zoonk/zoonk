"use client";

import { Button } from "@zoonk/ui/components/button";
import { CompassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { Eyebrow } from "../../_components/eyebrow";
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Eyebrow icon={<CompassIcon aria-hidden="true" />}>{t("Fine-tuning your plan")}</Eyebrow>
        <p className="text-muted-foreground text-compact text-pretty">
          {t("A miss here is never saved as a mistake.")}
          {onSkipToday && (
            <>
              {space}
              <Button busy={isPending} onClick={skipToday} variant="link">
                {t("Not today")}
              </Button>
            </>
          )}
        </p>
      </div>

      {failed && <ChangeSaveError className="text-xs" />}
    </div>
  );
}
