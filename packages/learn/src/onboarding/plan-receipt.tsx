"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { daysUntilIsoDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { OnboardingRailSection } from "./onboarding-rail";
import { readLevelChoice, toLevelAnswer, useOwnLevelLabels } from "./steps/level-choices";
import { useDetailRows, useLanguageRows } from "./understood/use-understood-rows";

type ReceiptFact = { count?: string; id: string; label: string; mono?: boolean; value: string };

function isAnswered({ goal, question }: { goal: GoalView; question: string }): boolean {
  const answered = goal.details.answered;
  return Array.isArray(answered) && answered.includes(question);
}

function useLevelText() {
  const ownLevels = useOwnLevelLabels();

  return function levelText(details: GoalView["details"]): string | null {
    const { level, levelNote } = details;

    if (typeof level === "string" && parseCefrScore(level) !== null) {
      return level;
    }

    if (typeof levelNote === "string" && levelNote.trim() !== "") {
      return levelNote;
    }

    const choice = readLevelChoice(details);
    const own = choice && toLevelAnswer(choice);

    return own ? ownLevels[own] : null;
  };
}

function useDateFact() {
  const t = useExtracted();
  const today = useMountTime();
  const formatDate = useFormatIsoDate();

  return function dateFact(goal: GoalView): ReceiptFact | null {
    const label = goal.kind === "exam" ? t("Exam date") : t("Date");

    if (goal.targetDate) {
      return {
        count: t("{days, plural, =0 {# days} one {# day} other {# days}}", {
          days: Math.max(0, daysUntilIsoDate({ isoDate: goal.targetDate, today })),
        }),
        id: "date",
        label,
        value: formatDate(goal.targetDate, "long"),
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
    { id: "title", label: t("Goal"), value: goal.title },
    dateFact(goal),
    ...languageRows(goal),
    ...detailRows(goal, null),
    level !== null && { id: "level", label: t("Your level"), value: level },
    isAnswered({ goal, question: "schedule" }) && {
      id: "time",
      label: t("Time a day"),
      mono: true,
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
      <dl className="flex flex-col [&>div+div]:border-t">
        {facts.map((fact) => (
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2.5 text-sm" key={fact.id}>
            <dt className="text-muted-foreground text-[0.8125rem]">{fact.label}</dt>
            <dd className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "font-medium text-pretty wrap-break-word",
                  fact.mono && "font-mono tabular-nums",
                )}
              >
                {fact.value}
              </span>
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

const CHIP_FACTS = new Set([
  "title",
  "targetLanguage",
  "targetCourse",
  "institution",
  "targetPosition",
  "targetScore",
  "date",
]);

export function PlanReceiptChips({ className, goal }: { className?: string; goal: GoalView }) {
  const t = useExtracted();
  const facts = useReceiptFacts(goal).filter((fact) => CHIP_FACTS.has(fact.id));

  return (
    <FactChips aria-label={t("Your plan so far")} className={className}>
      {facts.map((fact) => (
        <FactChip
          className={cn(fact.id === "title" && "text-foreground", fact.count && "font-mono")}
          key={fact.id}
        >
          {fact.count ?? fact.value}
        </FactChip>
      ))}
    </FactChips>
  );
}
