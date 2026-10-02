"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { useExperienceMode } from "../mode-provider";

/** The buddy waits awake: there's nothing to nap about on the first day. */
function FunWaitingBuddy({ buddy }: { buddy: LearnBuddy }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative flex items-center justify-center">
        <span aria-hidden="true" className="fun-planet animate-fun-glow absolute size-24" />
        <Buddy
          beltColor={buddy.beltColor}
          className="relative size-20"
          energy={buddy.energy}
          expression="happy"
          glasses={buddy.glasses}
          kind={buddy.kind}
          label={name}
        />
      </div>
      <p className="text-fun-fg2 text-sm">{t("{name} is plotting the route.", { name })}</p>
    </div>
  );
}

/**
 * Today while the goal's plan is still being built after onboarding: the run's progress as it
 * happens, turning into Today on its own once the plan is ready (the host reads Today again).
 */
export function TodayPreparing({
  buddy,
  goalTitle,
  onRefresh,
  run,
}: {
  buddy: LearnBuddy | null;
  goalTitle: string;
  /** Reads Today again: the day shows as soon as the plan exists. */
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-12"
      data-slot="today-preparing"
    >
      {mode === "fun" && buddy && <FunWaitingBuddy buddy={buddy} />}

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
