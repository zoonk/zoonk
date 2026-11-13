"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";

export function useMistakeCount(): number {
  const { runner } = useMockScreen();
  // A question with several picks answered partly right missed some, so the notebook keeps it too.
  return runner.view.review.filter((entry) => entry.outcome !== "blank").length;
}

export function MockResultActions() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();

  if (runner.view.purpose === "placement" || mistakes === 0) {
    return <TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>;
  }

  return (
    <TaskMainLink href={hrefs.mistakes} icon={<PlayIcon aria-hidden="true" />}>
      {t("Review mistakes")}
    </TaskMainLink>
  );
}

/**
 * The way on without reviewing: the bar's second action, outlined beside the main one. On a phone
 * it takes the line above, since a translated pair doesn't fit one row with the way back.
 */
export function MockResultSkip() {
  const t = useExtracted();
  const { hrefs, runner } = useMockScreen();
  const mistakes = useMistakeCount();

  if (mistakes === 0 || runner.view.purpose === "placement") {
    return null;
  }

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "xl", variant: "outline" }),
        "shrink-0 max-lg:order-first max-lg:basis-full",
      )}
      href={hrefs.continue}
    >
      {t("Not now")}
    </LearnLink>
  );
}
