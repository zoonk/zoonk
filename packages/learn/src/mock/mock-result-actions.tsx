"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { StepCard, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";

/** The questions answered wrong: the ones to fix. Blanks are reviewed but aren't mistakes. */
export function useMistakeCount(): number {
  const { runner } = useMockScreen();
  // A question with several picks answered partly right missed some, so the notebook keeps it too.
  return runner.view.review.filter((entry) => entry.outcome !== "blank").length;
}

function useMistakesTitle() {
  const t = useExtracted();

  return (count: number) =>
    t("{count, plural, one {# mistake to review} other {# mistakes to review}}", { count });
}

/** The one thing to do now, a phone's last step: the mistakes to review. */
export function MockNextStep({ count }: { count: number }) {
  const t = useExtracted();
  const title = useMistakesTitle();

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Now")}</StepEyebrow>
        <StepTitle>{title(count)}</StepTitle>
      </StepHeader>
    </StepCard>
  );
}

/** What's next beside a wide screen's result: the mistakes to review, as Today lists a block. */
export function MockNextRow({ count }: { count: number }) {
  const title = useMistakesTitle();

  return (
    <ListGroup>
      <ListRow>
        <ListRowLeading>
          <KindMark kind="mistakes" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{title(count)}</ListRowTitle>
        </ListRowContent>
      </ListRow>
    </ListGroup>
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

/**
 * The way on without reviewing the mistakes: back to the day's session, or "Not now". From `lg` it
 * sits before the main action in the bar's row (`row`), as every task bar puts its secondary; on a
 * phone, where two long labels don't share a row, it's a quiet button under the main action
 * (`under`).
 */
export function MockResultOptions({ placement }: { placement: "row" | "under" }) {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();
  const fromSession = runner.view.purpose === "planned";

  if (mistakes === 0 || runner.view.purpose === "placement") {
    return null;
  }

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "xl", variant: placement === "row" ? "outline" : "ghost" }),
        placement === "row" ? "shrink-0 max-lg:hidden" : "w-full lg:hidden",
      )}
      href={hrefs.continue}
    >
      {fromSession ? t("Continue today's session") : t("Not now")}
    </LearnLink>
  );
}
