"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { daysUntilIsoDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { OnboardingRailSection } from "./onboarding-rail";
import { useDetailRows, useLanguageRows } from "./understood/use-understood-rows";

type ReceiptFact = { count?: string; id: string; label: string; mono?: boolean; value: string };

function isAnswered({ goal, question }: { goal: GoalView; question: string }): boolean {
  const answered = goal.details.answered;
  return Array.isArray(answered) && answered.includes(question);
}

function useReceiptFacts(goal: GoalView): ReceiptFact[] {
  const t = useExtracted();
  const today = useMountTime();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const languageRows = useLanguageRows();
  const detailRows = useDetailRows();
  const levelNote = goal.details.levelNote;

  const date: ReceiptFact | null = goal.targetDate
    ? {
        count: t("{days, plural, =0 {# days} one {# day} other {# days}}", {
          days: Math.max(0, daysUntilIsoDate({ isoDate: goal.targetDate, today })),
        }),
        id: "date",
        label: goal.kind === "exam" ? t("Exam date") : t("Date"),
        value: formatDate(goal.targetDate, "long"),
      }
    : null;

  const facts: (ReceiptFact | null | false)[] = [
    { id: "title", label: t("Goal"), value: goal.title },
    date,
    ...languageRows(goal),
    ...detailRows(goal, null),
    typeof levelNote === "string" &&
      levelNote.trim() !== "" && { id: "level", label: t("Level"), value: levelNote },
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
