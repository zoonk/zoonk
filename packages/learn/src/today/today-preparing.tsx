"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";

/**
 * Today while the goal's plan is still being built after onboarding: the run's progress as it
 * happens, turning into Today on its own once the plan is ready (the host reads Today again).
 */
export function TodayPreparing({
  goalTitle,
  onRefresh,
  run,
}: {
  goalTitle: string;
  /** Reads Today again: the day shows as soon as the plan exists. */
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-12"
      data-slot="today-preparing"
    >
      <GenerationWait kind="firstLesson" run={run}>
        <GenerationTimelineTitle>
          {t("Building your plan for {goal}", { goal: goalTitle })}
        </GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("It usually takes a minute or two. Your first day opens here as soon as it's ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </section>
  );
}
