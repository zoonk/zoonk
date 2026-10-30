import { GoalForm } from "@/components/public/goal-form";
import { Variant } from "@/components/public/variant-switch";
import { getExtracted, getFormatter } from "next-intl/server";
import { getExamplePlans } from "./example-plans";
import { EXAMPLE_GOALS, type ExampleGoal, GOAL_SWITCH, getExampleSet } from "./landing-examples";

async function getGoalExamples(): Promise<Record<ExampleGoal, string>> {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const plans = await getExamplePlans();

  const month = (goal: ExampleGoal) =>
    format.dateTime(plans[goal].date, { month: "long", timeZone: "UTC" });

  return {
    exam:
      set.exam === "enem"
        ? t("get ready for the ENEM in {month}", { month: month("exam") })
        : t("get ready for the SAT in {month}", { month: month("exam") }),
    job: t("get promoted to data analyst by {month}", { month: month("job") }),
    move:
      set.move === "madrid"
        ? t("speak Spanish for my move to Madrid in {month}", { month: month("move") })
        : t({
            description:
              "An example goal a learner might type; {month} is a month name. Use your language's name for London.",
            message: "speak English for my move to London in {month}",
            values: { month: month("move") },
          }),
  };
}

export async function LandingGoalBox({ action, id }: { action: string; id: string }) {
  const t = await getExtracted();
  const examples = await getGoalExamples();

  return (
    <GoalForm
      action={action}
      example={EXAMPLE_GOALS.map((goal) => (
        <Variant as="span" key={goal} name={GOAL_SWITCH} value={goal}>
          {examples[goal]}
        </Variant>
      ))}
      id={id}
      note={t("Start free, no account needed.")}
    />
  );
}
