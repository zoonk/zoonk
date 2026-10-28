"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useLessonsEffectText } from "../plan/use-effect-counts";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";
import { useChallengeScreen } from "./challenge-context";
import { MoveFailed } from "./challenge-move-failed";

export function ChallengeMovedScreen({
  changeId,
  effect,
}: {
  changeId: string;
  effect: PlanChangeView["effect"] | null;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const lessonsText = useLessonsEffectText();
  const leftOut = effect && effect.lessonsRemoved > 0 ? lessonsText(effect) : null;
  const { challenge, hrefs, move } = useChallengeScreen();
  const date = challenge.date ?? challenge.today;

  return (
    <TaskFrame
      closeOnEscape
      exitHref={hrefs.exit}
      footer={
        <>
          <MoveFailed />
          <TaskActions>
            <TaskMainLink href={hrefs.exit}>{t("Back to Today")}</TaskMainLink>
            <Button
              className="shrink-0"
              disabled={move.pending}
              onClick={() => void move.undo(changeId)}
              size="xl"
              variant="outline"
            >
              {t("Undo")}
            </Button>
          </TaskActions>
        </>
      }
    >
      <StepCard role="status">
        <StepHeader>
          <StepTitle>{t("Moved to {date}", { date: formatDate(date, "weekdayDay") })}</StepTitle>
          <StepDetail>
            {[t("Your plan moved later lessons to make room for it."), leftOut]
              .filter(Boolean)
              .join(" ")}
          </StepDetail>
        </StepHeader>
      </StepCard>
    </TaskFrame>
  );
}
