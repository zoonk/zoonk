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

/** One thing the plan already knows: what it is, and its value, numbers in the mono face. */
type ReceiptFact = {
  /** A count beside the value, in the mono face ("41 days" beside the exam's day). */
  count?: string;
  id: string;
  label: string;
  mono?: boolean;
  value: string;
};

/** Whether the learner already answered a question, as the goal saves its answers. */
function isAnswered({ goal, question }: { goal: GoalView; question: string }): boolean {
  const answered = goal.details.answered;
  return Array.isArray(answered) && answered.includes(question);
}

/**
 * What the goal's words and the learner's answers have set so far, in the order they read: the
 * goal, its date and the days left, the language, the course, target and role, the level they
 * said, and the time a day once it's chosen. Each answer that sets one adds it.
 */
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

/**
 * "Your plan so far", beside every question from 72rem: what the plan already knows, as label and
 * value rows that fill in with each answer, so the learner sees what each one changes.
 */
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

/** The short facts a phone's chips show; the rest (why, the role, the level) stay in the rail. */
const CHIP_FACTS = new Set([
  "title",
  "targetLanguage",
  "targetCourse",
  "institution",
  "targetPosition",
  "targetScore",
  "date",
]);

/**
 * The plan so far as one row of chips at the top of the screen, until the page's aside shows it: the
 * goal, its language, course or target, and the days left ("ENEM 2026 · medicine · 41 days"). The
 * screen shows it where a decision depends on it, such as the time a day.
 */
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
