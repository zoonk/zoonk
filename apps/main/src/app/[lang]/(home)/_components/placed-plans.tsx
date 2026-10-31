import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { Variant } from "@/components/public/variant-switch";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { StatusMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type PlacedRow } from "./example-set";
import { EXAMPLE_GOALS, type ExampleGoal, GOAL_SWITCH, getExampleSet } from "./landing-examples";

async function getPlacedPlans(): Promise<
  Record<ExampleGoal, { rows: readonly PlacedRow[]; skipped: number }>
> {
  const t = await getExtracted();
  const set = await getExampleSet();

  return {
    exam: { rows: set.exam.placed.rows, skipped: 12 },
    job: {
      rows: [
        { id: "basics", state: "skipped", title: t("Spreadsheet basics") },
        { id: "formulas", state: "skipped", title: t("Formulas") },
        { id: "select", lessons: 6, state: "next", title: t("SQL: SELECT and WHERE") },
        { id: "joins", lessons: 5, state: "todo", title: t("Joins") },
        { id: "group-by", lessons: 6, state: "todo", title: t("GROUP BY") },
      ],
      skipped: 10,
    },
    move: {
      rows: [
        { id: "greetings", state: "skipped", title: t("Greetings and introductions") },
        { id: "numbers", state: "skipped", title: t("Numbers and prices") },
        { id: "cafe", state: "skipped", title: t("Ordering at a café") },
        { id: "renting", lessons: 6, state: "next", title: t("Renting a flat") },
        { id: "bank", lessons: 8, state: "todo", title: t("Bank and phone") },
      ],
      skipped: 9,
    },
  };
}

async function PlacedPlanPicture({
  plan,
}: {
  plan: { rows: readonly PlacedRow[]; skipped: number };
}) {
  const t = await getExtracted();
  // Its own namespace: a placed topic's "Skipped" agrees with topics of any gender and number,
  // unlike the app's status word for one chapter.
  const tPlaced = await getExtracted("placedPlan");

  return (
    <>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold">{t("Your plan")}</span>
        <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs whitespace-nowrap")}>
          {t("{count, plural, one {# lesson skipped} other {# lessons skipped}}", {
            count: plan.skipped,
          })}
        </span>
      </p>

      <ListGroup className="isolate" role="list">
        {plan.rows.map((row) => (
          <ListRow
            data-highlighted={row.state === "next" || undefined}
            key={row.id}
            role="listitem"
          >
            <StatusMark className="self-center" status={row.state} />

            <ListRowContent>
              <ListRowTitle
                className={cn(
                  row.state === "skipped" && "text-muted-foreground font-normal",
                  row.state === "todo" && "font-normal",
                )}
              >
                {row.title}
              </ListRowTitle>
            </ListRowContent>

            <ListRowTrailing className={cn(row.state === "skipped" && "font-sans")}>
              {row.lessons === undefined
                ? tPlaced("Skipped")
                : t("{count, plural, one {# lesson} other {# lessons}}", { count: row.lessons })}
            </ListRowTrailing>
          </ListRow>
        ))}
      </ListGroup>
    </>
  );
}

export async function PlacedPlans() {
  const placed = await getPlacedPlans();

  return EXAMPLE_GOALS.map((goal) => (
    <Variant className="flex flex-col gap-2" key={goal} name={GOAL_SWITCH} value={goal}>
      <PlacedPlanPicture plan={placed[goal]} />
    </Variant>
  ));
}
