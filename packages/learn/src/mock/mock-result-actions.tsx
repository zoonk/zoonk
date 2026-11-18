"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";

/** On a phone the bar's second action takes the line above the main one and the way back. */
export const BAR_SECOND_ACTION_CLASS = "shrink-0 max-lg:basis-full";

function useMistakeCount(): number {
  const { runner } = useMockScreen();
  // A question with several picks answered partly right missed some, so the notebook keeps it too.
  return runner.view.review.filter((entry) => entry.outcome !== "blank").length;
}

export function MockResultActions() {
  const t = useExtracted();
  const { hrefs } = useMockScreen();

  return <TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>;
}

export function MockResultMistakes() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();

  if (mistakes === 0 || runner.view.purpose === "placement") {
    return null;
  }

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "xl", variant: "outline" }), BAR_SECOND_ACTION_CLASS)}
      href={hrefs.mistakes}
    >
      {t("Review mistakes")}
    </LearnLink>
  );
}
