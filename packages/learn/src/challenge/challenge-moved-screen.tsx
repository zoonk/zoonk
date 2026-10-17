"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskActions } from "../_components/task-layout";
import { useFormatIsoDate } from "../_utils/iso-date";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";
import { useChallengeScreen } from "./challenge-context";
import { MoveFailed } from "./challenge-move-failed";

/** The new day in the title, in the mono face like every date. */
function renderMono(chunks: React.ReactNode) {
  return <span className="font-mono font-medium tracking-[-0.04em]">{chunks}</span>;
}

/**
 * Right after "Move to Monday" on the week's challenge or mock: its new day, that the lessons it
 * displaced moved too and nothing is lost, like any result, with Back to Today as the way on and
 * Undo beside it while the plan is as the move left it.
 */
export function ChallengeMovedScreen({ changeId }: { changeId: string }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
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
          <StepTitle>
            {t.rich("Moved to <mono>{date}</mono>", {
              date: formatDate(date, "weekdayDay"),
              mono: renderMono,
            })}
          </StepTitle>
          <StepDetail>
            {t(
              "Your plan made room for it and moved any lessons that didn't fit. Nothing is lost.",
            )}
          </StepDetail>
        </StepHeader>
      </StepCard>
    </TaskFrame>
  );
}
