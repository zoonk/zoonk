"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { getPracticedMock } from "./practiced-mock";

/** On a phone the bar's second action takes the line above the main one and the way back. */
export const BAR_SECOND_ACTION_CLASS = "shrink-0 max-lg:basis-full";

function usePracticedMock(): string | null {
  return getPracticedMock(useMockScreen().runner.view);
}

export function MockResultActions() {
  const t = useExtracted();
  const { hrefs } = useMockScreen();
  const mockId = usePracticedMock();

  if (!mockId) {
    return <TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>;
  }

  return (
    <TaskMainLink href={hrefs.mistakes(mockId)}>
      {t({
        description: "Opens practice on the mistakes that are ready to fix.",
        id: "practiceMistakesAction",
        message: "Practice mistakes",
      })}
    </TaskMainLink>
  );
}

/**
 * The way on without reviewing, named as every result's way on is: the bar's second action,
 * outlined beside the main one. On a phone it takes the line above, since a translated pair
 * doesn't fit one row with the way back.
 */
export function MockResultContinue() {
  const t = useExtracted();
  const { hrefs } = useMockScreen();

  if (!usePracticedMock()) {
    return null;
  }

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "xl", variant: "outline" }), BAR_SECOND_ACTION_CLASS)}
      href={hrefs.continue}
    >
      {t("Continue")}
    </LearnLink>
  );
}
