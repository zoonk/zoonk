"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { StepCard, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockReviewSheet } from "./mock-review";

/** The questions answered wrong: the ones to fix. Blanks are reviewed but aren't mistakes. */
export function useMistakeCount(): number {
  const { runner } = useMockScreen();
  return runner.view.review.filter((entry) => entry.outcome === "wrong").length;
}

/** The one thing to do now: the mistakes to review. */
export function MockNextStep({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <StepCard>
      <KindTile kind="mistakes" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Now")}</StepEyebrow>
        <StepTitle>
          {t("{count, plural, one {# mistake to review} other {# mistakes to review}}", { count })}
        </StepTitle>
      </StepHeader>
    </StepCard>
  );
}

/**
 * Review the mistakes when there are some; otherwise back to the day. A placement mock goes on to
 * the plan its answers set. Enter follows it.
 */
export function MockResultActions() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();

  if (runner.view.purpose === "placement") {
    return <TaskMainLink href={hrefs.continue}>{t("See my plan")}</TaskMainLink>;
  }

  if (mistakes === 0) {
    return <TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>;
  }

  return (
    <TaskMainLink href={hrefs.mistakes}>
      {t("{count, plural, one {Review the mistake} other {Review the # mistakes}}", {
        count: mistakes,
      })}
    </TaskMainLink>
  );
}

/** The quiet ways on: back to the day without reviewing, and the questions with their answers. */
export function MockResultOptions() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();
  const fromSession = runner.view.purpose === "planned";

  return (
    <>
      {mistakes > 0 && runner.view.purpose !== "placement" && (
        <LearnLink
          className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "w-full")}
          href={hrefs.continue}
        >
          {fromSession ? t("Continue today's session") : t("Not now")}
        </LearnLink>
      )}
      <MockReviewSheet />
    </>
  );
}
