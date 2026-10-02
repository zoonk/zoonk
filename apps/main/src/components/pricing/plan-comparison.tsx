import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
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

type ComparisonRow = { feature: string; free: string; plus: string };

/**
 * The free plan's numbers come from the same limits the allowance enforces, so the page can't
 * drift from what learners actually get. Plus's limits only stop automated use, so to a learner
 * they're unlimited; the questions under the plans link the fair use policy.
 */
async function getPlanComparison(): Promise<ComparisonRow[]> {
  const t = await getExtracted();
  const limits = getFreePlanLimits();
  const unlimited = t("Unlimited");

  return [
    {
      feature: t("New lessons"),
      free: t("{day, number} a day, {month, number} a month", {
        day: limits.lessonsPerDay ?? 0,
        month: limits.lessonsPerMonth ?? 0,
      }),
      plus: unlimited,
    },
    {
      feature: t("Goals at once"),
      free: t("{count, plural, one {# goal} other {# goals}}", { count: limits.activeGoals ?? 0 }),
      plus: unlimited,
    },
    {
      feature: t("Exam prep"),
      free: t({
        description:
          "Free plan's exam prep in the plan comparison: only its start (the diagnostic, the plan and the first week), never mock exams. Agree with the word for 'Exam prep'.",
        message: "Limited",
      }),
      plus: t({
        description:
          "Plus's exam prep in the plan comparison: the whole plan to exam day, including mock exams.",
        message: "Full prep",
      }),
    },
    {
      feature: t("AI tutor"),
      free: t("{count, plural, one {# message} other {# messages}} a day", {
        count: limits.tutorMessagesPerDay ?? 0,
      }),
      plus: unlimited,
    },
    {
      feature: t("Speaking practice"),
      free: t("{count, plural, one {# conversation} other {# conversations}} a day", {
        count: limits.conversationsPerDay ?? 0,
      }),
      plus: unlimited,
    },
    {
      feature: t("Your notes and files"),
      free: t("{count, plural, one {# upload} other {# uploads}} a day", {
        count: limits.uploadsPerDay ?? 0,
      }),
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
    <dl className="flex flex-col divide-y">
      {rows.map((row) => (
        <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0" key={row.feature}>
          <dt className="text-sm font-medium">{row.feature}</dt>
          <dd className="text-muted-foreground text-sm">{keepNumbersWithWords(row.plus)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Free and Plus side by side, so the difference is one glance instead of a list of promises.
 * The explicit roles keep it a table for assistive technology while phones change its layout.
 */
export async function PlanComparison() {
  const [t, rows] = await Promise.all([getExtracted(), getPlanComparison()]);

  return (
    <div className="px-1 py-6 sm:px-4 sm:py-8">
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
    </div>
  );
}
