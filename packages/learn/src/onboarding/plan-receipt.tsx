"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { toLanguageAimView } from "@zoonk/core/language/aims";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useDaysLeftText } from "../_components/days-left";
import { daysUntilIsoDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { readSetupLevel } from "./_utils/setup-level";
import { OnboardingRailSection } from "./onboarding-rail";
import { useOwnLevelLabels } from "./steps/level-choices";
import { useDetailRows, useLanguageRows } from "./understood/use-understood-rows";

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

function useDateFact() {
  const t = useExtracted();
  const today = useMountTime();
  const daysLeftText = useDaysLeftText();
  const formatDate = useFormatIsoDate();

  return function dateFact(goal: GoalView): ReceiptFact | null {
    const label = goal.kind === "exam" ? t("Exam date") : t("End date");

    if (goal.targetDate) {
      return {
        count: daysLeftText(Math.max(0, daysUntilIsoDate({ isoDate: goal.targetDate, today }))),
        id: "date",
        label,
        value: formatDate(goal.targetDate, "row", { year: "always" }),
      };
    }

    return isAnswered({ goal, question: "targetDate" })
      ? { id: "date", label, value: t("No date") }
      : null;
  };
}

function useReceiptFacts(goal: GoalView): ReceiptFact[] {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const languageRows = useLanguageRows();
  const detailRows = useDetailRows();
  const dateFact = useDateFact();
  const levelText = useLevelText();
  const level = levelText(goal.details);

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
    level !== null && { id: "level", label: t("Level"), value: level },
    isAnswered({ goal, question: "schedule" }) && {
      id: "time",
      label: t("Time a day"),
      value: formatDuration(goal.dailyMinutes),
    },
  ];

  return facts.filter((fact): fact is ReceiptFact => Boolean(fact));
}

export function PlanReceipt({ goal }: { goal: GoalView }) {
  const t = useExtracted();
  const facts = useReceiptFacts(goal);

  return (
    <OnboardingRailSection id="onboarding-plan-so-far" title={t("Your plan so far")}>
      <dl className="grid grid-cols-[fit-content(50%)_minmax(0,1fr)] [&>div+div]:border-t">
        {facts.map((fact) => (
          <div
            className="col-span-2 grid grid-cols-subgrid items-baseline gap-3 py-2.5 text-sm"
            key={fact.id}
          >
            <dt className="text-muted-foreground text-compact text-pretty">{fact.label}</dt>
            <dd className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "text-pretty wrap-break-word",
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
