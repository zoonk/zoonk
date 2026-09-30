import { Link } from "@/i18n/navigation";
import { getFreePlanLimits, getPlusPlanLimits } from "@zoonk/core/entitlements/plan-limits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

type ComparisonRow = { feature: string; free: string; plus: string };

/** One mark for every value that only fair use limits, explained once in the note under them. */
const FAIR_USE_MARK = "*";

function withFairUseMark(text: string) {
  return `${text}${FAIR_USE_MARK}`;
}

const NOTE_CLASS = "text-muted-foreground text-sm leading-relaxed text-pretty";

function renderFairUseLink(chunks: ReactNode) {
  return (
    <Link
      className="text-foreground font-medium underline underline-offset-4"
      href="/terms#fair-use"
    >
      {chunks}
    </Link>
  );
}

/**
 * The note under the marked values: unlimited for personal use, with the details in the terms'
 * fair use section, then Plus's one hard cap, so "Unlimited" never hides a limit.
 */
async function FairUseNote() {
  const t = await getExtracted();
  const { newGoalsPerDay } = getPlusPlanLimits();

  return (
    <p className={NOTE_CLASS}>
      {FAIR_USE_MARK}
      {t.rich("Unlimited for personal use, under our <link>fair use policy</link>.", {
        link: renderFairUseLink,
      })}
      {newGoalsPerDay !== null && (
        <>
          {" "}
          {t(
            "With Plus, you can start up to {count, plural, one {# new goal} other {# new goals}} a day.",
            { count: newGoalsPerDay },
          )}
        </>
      )}
    </p>
  );
}

/**
 * The free plan's numbers come from the same limits the allowance enforces, so the page can't
 * drift from what learners actually get. Plus's values are unlimited with fair use, marked and
 * explained in the note under them.
 */
async function getPlanComparison(): Promise<ComparisonRow[]> {
  const t = await getExtracted();
  const limits = getFreePlanLimits();
  const unlimited = withFairUseMark(t("Unlimited"));

  return [
    {
      feature: t("Active goals"),
      free: t("{count, plural, one {# goal} other {# goals}}", { count: limits.activeGoals ?? 0 }),
      plus: unlimited,
    },
    {
      feature: t("New lessons"),
      free: t("{day, number} a day, {month, number} a month", {
        day: limits.lessonsPerDay ?? 0,
        month: limits.lessonsPerMonth ?? 0,
      }),
      plus: unlimited,
    },
    {
      feature: t("Reviews, mistakes and quick explanations"),
      free: t("Included"),
      plus: t("Included"),
    },
    {
      feature: t("Exam prep"),
      free: t(
        "Diagnostic, plan and {days, plural, =7 {the first week} one {the first day} other {the first # days}}",
        { days: limits.examPrepDays ?? 0 },
      ),
      plus: t("Everything, including mock exams"),
    },
    {
      feature: t("AI tutor, uploads and conversations"),
      free: t(
        "{tutor, plural, one {# tutor message} other {# tutor messages}}, {uploads, plural, one {# upload} other {# uploads}} and {conversations, plural, one {# conversation} other {# conversations}} a day",
        {
          conversations: limits.conversationsPerDay ?? 0,
          tutor: limits.tutorMessagesPerDay ?? 0,
          uploads: limits.uploadsPerDay ?? 0,
        },
      ),
      plus: unlimited,
    },
  ];
}

/** Phones stack each row: the feature on top, then Free and Plus in two columns under their headers. */
const ROW_CLASS = "grid grid-cols-2 gap-x-6 hover:bg-transparent sm:table-row";
const COLUMN_HEAD_CLASS = "h-auto px-0 pb-3 sm:h-12 sm:w-[32%] sm:px-3 sm:pb-0";
const VALUE_CELL_CLASS = "p-0 align-top whitespace-normal sm:px-3 sm:py-4";

/** Keeps each number on the line of the word after it, so a narrow column never strands a "3". */
function keepNumbersWithWords(text: string) {
  return text.replaceAll(/(?<=\d) /gu, "\u00A0");
}

/** What a subscriber has with Plus, from the same rows the comparison shows. */
export async function PlusIncluded() {
  const rows = await getPlanComparison();

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col divide-y">
        {rows.map((row) => (
          <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0" key={row.feature}>
            <dt className="text-sm font-medium">{row.feature}</dt>
            <dd className="text-muted-foreground text-sm">{keepNumbersWithWords(row.plus)}</dd>
          </div>
        ))}
      </dl>

      <FairUseNote />
    </div>
  );
}

/**
 * Free and Plus side by side, so the difference is one glance instead of a list of promises.
 * The explicit roles keep it a table for assistive technology while phones change its layout.
 */
export async function PlanComparison({ isVisitor }: { isVisitor: boolean }) {
  const [t, rows] = await Promise.all([getExtracted(), getPlanComparison()]);
  const { guestLessons } = getFreePlanLimits();

  return (
    <div className="flex flex-col gap-4 px-1 py-6 sm:px-4 sm:py-8">
      <Table
        aria-label={t("What's included in Free and Plus")}
        className="block sm:table"
        role="table"
      >
        <TableHeader className="block sm:table-header-group" role="rowgroup">
          <TableRow className={ROW_CLASS} role="row">
            <TableHead className="sr-only sm:not-sr-only" role="columnheader">
              <span className="sr-only">{t("Feature")}</span>
            </TableHead>
            <TableHead className={COLUMN_HEAD_CLASS} role="columnheader">
              {t("Free")}
            </TableHead>
            <TableHead className={COLUMN_HEAD_CLASS} role="columnheader">
              {t("Plus")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="block sm:table-row-group" role="rowgroup">
          {rows.map((row) => (
            <TableRow
              className={cn(ROW_CLASS, "gap-y-1.5 py-4 sm:py-0")}
              key={row.feature}
              role="row"
            >
              <TableHead
                className="col-span-2 h-auto px-0 align-top whitespace-normal sm:py-4"
                role="rowheader"
                scope="row"
              >
                {row.feature}
              </TableHead>
              <TableCell className={cn(VALUE_CELL_CLASS, "text-muted-foreground")} role="cell">
                {keepNumbersWithWords(row.free)}
              </TableCell>
              <TableCell className={cn(VALUE_CELL_CLASS, "font-medium")} role="cell">
                {keepNumbersWithWords(row.plus)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-2">
        <FairUseNote />

        {isVisitor && guestLessons !== null && (
          <p className={NOTE_CLASS}>
            {t(
              "No account yet? You can try {count, plural, one {# lesson} other {# lessons}} first.",
              { count: guestLessons },
            )}
          </p>
        )}
      </div>
    </div>
  );
}
