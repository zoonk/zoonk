"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { toLanguageAimView } from "@zoonk/core/language/aims";
import {
  type LevelTestRanges,
  levelTestResultSchema,
} from "@zoonk/core/language/level-test/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import { useExtracted } from "next-intl";
import { useDaysLeftText } from "../_components/days-left";
import { daysBetween, getTodayInZone, useFormatIsoDate } from "../_utils/iso-date";
import { useLearnerClock } from "../_utils/learner-clock";
import { useFormatDuration } from "../_utils/time-format";
import { useLevelRangeFacts } from "../language/level-test/level-test-parts";
import { readSetupLevel } from "./_utils/setup-level";
import { OnboardingRailSection } from "./onboarding-rail";
import { useOwnLevelLabels } from "./steps/level-choices";
import { useDetailRows, useLanguageRows } from "./understood/use-understood-rows";

const levelTestRangesSchema = levelTestResultSchema.pick({ ranges: true });

type ReceiptFact = { count?: string; id: string; label: string; note?: string; value: string };

function isAnswered({ goal, question }: { goal: GoalView; question: string }): boolean {
  const answered = goal.details.answered;
  return Array.isArray(answered) && answered.includes(question);
}

function useLevelText() {
  const ownLevels = useOwnLevelLabels();

  return function levelText(details: GoalView["details"]): string | null {
    const level = readSetupLevel(details);

    if (!level) {
      return null;
    }

    return level.kind === "own" ? ownLevels[level.level] : level.text;
  };
}

function readSavedTestRanges(details: GoalView["details"]): LevelTestRanges | undefined {
  const test = details.levelTest;

  return isJsonObject(test)
    ? levelTestRangesSchema.safeParse(test.lastResult).data?.ranges
    : undefined;
}

function useLevelFact(goal: GoalView, testRanges?: LevelTestRanges | null): ReceiptFact | null {
  const t = useExtracted();
  const levelText = useLevelText();
  const levelRangeFacts = useLevelRangeFacts();

  if (goal.kind === "language") {
    const shown = testRanges === undefined ? readSavedTestRanges(goal.details) : testRanges;
    const ranges = levelRangeFacts(shown ?? {});

    return ranges.length > 0
      ? { id: "level", label: t("Level test"), value: ranges.join(" · ") }
      : null;
  }

  const level = levelText(goal.details);

  return level === null
    ? null
    : {
        id: "level",
        label: t({
          description:
            'Row with what the learner said they already know about their goal\'s subject, such as "I know a few things".',
          message: "What you know",
        }),
        value: level,
      };
}

function useDateFact() {
  const t = useExtracted();
  const { now } = useLearnerClock();
  const daysLeftText = useDaysLeftText();
  const formatDate = useFormatIsoDate();

  return function dateFact(goal: GoalView): ReceiptFact | null {
    const label = goal.kind === "exam" ? t("Exam date") : t("End date");

    if (goal.targetDate) {
      return {
        count: daysLeftText(
          Math.max(
            0,
            daysBetween(getTodayInZone({ now, timeZone: goal.timezone }), goal.targetDate),
          ),
        ),
        id: "date",
        label,
        value: formatDate(goal.targetDate, "row", { year: "always" }),
      };
    }

    if (!isAnswered({ goal, question: "targetDate" })) {
      return null;
    }

    return {
      id: "date",
      label,
      value: goal.kind === "exam" ? t("To be confirmed") : t("None set"),
    };
  };
}

function useReceiptFacts(goal: GoalView, testRanges?: LevelTestRanges | null): ReceiptFact[] {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const languageRows = useLanguageRows();
  const detailRows = useDetailRows();
  const dateFact = useDateFact();
  const level = useLevelFact(goal, testRanges);

  const facts: (ReceiptFact | null | false)[] = [
    { id: "title", label: t("Goal"), value: goal.displayName },
    dateFact(goal),
    ...languageRows({ draft: goal, regionChoices: goal.regionChoices }),
    ...detailRows(
      goal,
      null,
      goal.kind === "language"
        ? toLanguageAimView({ details: goal.details, targetLanguage: goal.targetLanguage ?? null })
        : null,
    ),
    level,
    isAnswered({ goal, question: "schedule" }) && {
      id: "time",
      label: t("Time a day"),
      value: formatDuration(goal.dailyMinutes),
    },
  ];

  return facts.filter((fact): fact is ReceiptFact => Boolean(fact));
}

export function PlanReceipt({
  goal,
  testRanges,
}: {
  goal: GoalView;
  testRanges?: LevelTestRanges | null;
}) {
  const t = useExtracted();
  const facts = useReceiptFacts(goal, testRanges);

  return (
    <OnboardingRailSection id="onboarding-plan-so-far" title={t("Your plan so far")}>
      <dl className="grid grid-cols-[fit-content(50%)_minmax(0,1fr)] [&>div+div]:border-t">
        {facts.map((fact) => (
          <div
            className="col-span-2 grid grid-cols-subgrid items-baseline gap-3 py-2.5 text-sm"
            key={fact.id}
          >
            <dt className="text-muted-foreground text-compact">{fact.label}</dt>
            <dd className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "wrap-break-word",
                  (fact.id === "time" || (fact.id === "date" && fact.count)) &&
                    "font-mono tabular-nums",
                )}
              >
                {fact.value}
              </span>
              {fact.note && (
                <span className="text-muted-foreground text-xs wrap-break-word">{fact.note}</span>
              )}
              {fact.count && (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {fact.count}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </OnboardingRailSection>
  );
}
