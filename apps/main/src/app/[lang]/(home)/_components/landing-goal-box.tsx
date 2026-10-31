import { GoalForm } from "@/components/public/goal-form";
import { Variant } from "@/components/public/variant-switch";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ReactNode } from "react";
import {
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  getExampleCalendar,
  getExampleSet,
  getGoalDate,
} from "./landing-examples";

async function getGoalExamples(): Promise<Record<ExampleGoal, string>> {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const calendar = await getExampleCalendar();

  const month = (goal: ExampleGoal) =>
    format.dateTime(getGoalDate({ calendar, goal }), { month: "long", timeZone: "UTC" });

  return {
    exam: set.exam.goal(month("exam")),
    job: t({
      description:
        "An example goal a learner might type; {month} is a month name. In Brazilian Portuguese: “virar analista de dados até {month}”.",
      message: "become a data analyst by {month}",
      values: { month: month("job") },
    }),
    move:
      set.move === "mexico-city"
        ? t({
            description:
              "An example goal a learner might type; {month} is a month name. Use your language's name for Mexico City.",
            message: "speak Spanish for my move to Mexico City in {month}",
            values: { month: month("move") },
          })
        : t({
            description:
              "An example goal a learner might type; {month} is a month name. Use your language's name for London. In Brazilian Portuguese: “falar inglês para me mudar para Londres em {month}”.",
            message: "speak English for my move to London in {month}",
            values: { month: month("move") },
          }),
  };
}

export async function LandingGoalBox({
  action,
  fillsFromChips = false,
  id,
  note,
}: {
  action: string;
  fillsFromChips?: boolean;
  id: string;
  note?: ReactNode;
}) {
  const examples = await getGoalExamples();

  return (
    <GoalForm
      action={action}
      example={
        <span className="grid *:col-start-1 *:row-start-1">
          {EXAMPLE_GOALS.map((goal) => (
            <Variant as="span" key={goal} name={GOAL_SWITCH} stacked value={goal}>
              {examples[goal]}
            </Variant>
          ))}
        </span>
      }
      exampleChoices={fillsFromChips ? { examples, name: GOAL_SWITCH } : undefined}
      id={id}
      note={note}
    />
  );
}
