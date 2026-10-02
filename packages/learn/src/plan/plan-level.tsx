"use client";

import { type OwnLevelChange } from "@zoonk/core/plans/own-level-contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";

type Level = OwnLevelChange["level"];

const LEVELS: readonly Level[] = ["none", "basic", "intermediate", "advanced"];

/** Goals with a level to give: a subject to learn or an exam. Languages use CEFR instead. */
const LEVEL_GOALS = new Set(["exam", "learn"]);

function useLevelLabel() {
  const t = useExtracted();

  const labels: Record<Level, string> = {
    advanced: t("I know it well"),
    basic: t("The basics"),
    intermediate: t("I studied it before"),
    none: t("Nothing, I'm just starting"),
  };

  return (level: Level): string => labels[level];
}

/** What changing the level did, in one sentence, with test-outs when the level went up. */
function LevelOutcome({ outcome }: { outcome: OwnLevelChange }) {
  const t = useExtracted();
  const { testOutBasePath } = usePlanScreen();

  if (outcome.direction === "lower") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {outcome.change
          ? t("The foundations you need now come first in your plan. You can undo it above.")
          : t("Your plan already starts from the foundations.")}
      </p>
    );
  }

  if (outcome.direction === "same" || outcome.testOuts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Saved. Nothing you've done changed.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="status">
      <p className="text-muted-foreground text-sm">
        {t("Know these already? A quick test skips them. Nothing is skipped until you pass.")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {outcome.testOuts.map((chapter) => (
          <li key={chapter.chapterId}>
            <LearnLink
              // Rounded, not a pill: "Test out of" and a chapter's title can take two lines.
              className="bg-muted in-data-[mode=fun]:fun-glass focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-2xl px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
              href={`${testOutBasePath}/${chapter.chapterId}`}
              prefetch={false}
            >
              {t("Test out of {chapter}", { chapter: chapter.title })}
            </LearnLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Your level" in "Change your plan": the learner can say they know more or less than they
 * thought. Past work never changes: a lower level adds the foundations with an undo, a higher one
 * offers test-outs. The same control in both modes.
 */
export function PlanLevel() {
  const t = useExtracted();
  const levelLabel = useLevelLabel();
  const analytics = useLearnAnalytics();
  const { actions, goal, plan } = usePlanScreen();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<OwnLevelChange | "failed" | null>(null);
  const { changeLevel } = actions;

  if (!changeLevel || !LEVEL_GOALS.has(goal.kind)) {
    return null;
  }

  const choose = (level: Level) => {
    setOutcome(null);

    startTransition(async () => {
      const result = await changeLevel(level);
      setOutcome(result ?? "failed");

      if (result) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "ownLevel" } });
      }
    });
  };

  return (
    <section aria-labelledby="plan-level-title" className="flex flex-col gap-2">
      {/* Labeled like the schedule's fields around it in "Change your plan". */}
      <h2 className="text-sm font-medium" id="plan-level-title">
        {t("Your level")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t(
          "Know more or less than you thought? Your plan adjusts, and nothing you've done is lost.",
        )}
      </p>
      <div aria-labelledby="plan-level-title" className="flex flex-wrap gap-2" role="group">
        {LEVELS.map((level) => (
          <Toggle
            className="aria-pressed:bg-foreground aria-pressed:text-background h-11 px-4"
            disabled={isPending}
            focusableWhenDisabled
            key={level}
            onPressedChange={() => level !== plan.ownLevel && choose(level)}
            pressed={plan.ownLevel === level}
            variant="outline"
          >
            {levelLabel(level)}
          </Toggle>
        ))}
      </div>
      {outcome === "failed" && <PlanFailedMessage />}
      {outcome && outcome !== "failed" && <LevelOutcome outcome={outcome} />}
    </section>
  );
}
