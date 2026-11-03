import { GoalForm } from "@/components/public/goal-form";
import { getExtracted, getFormatter } from "next-intl/server";
import { getExampleExamDay, getExampleSet } from "./landing-examples";

async function getExamGoal(): Promise<string> {
  const format = await getFormatter();
  const { exam } = await getExampleSet();
  const examDay = await getExampleExamDay();

  return exam.goal(format.dateTime(examDay, { month: "long", timeZone: "UTC" }));
}

async function getLanguageGoal(): Promise<string> {
  const t = await getExtracted();
  const { move } = await getExampleSet();

  return move === "mexico-city"
    ? t({
        description:
          "An example goal a learner might type, short enough to fit on one line beside a button. Use your language's name for Mexico City.",
        message: "speak Spanish to live in Mexico City",
      })
    : t({
        description:
          "An example goal a learner might type, short enough to fit on one line beside a button. Use your language's name for London. In Brazilian Portuguese: “falar inglês para morar em Londres”.",
        message: "speak English to live in London",
      });
}

export async function LandingGoalBox({
  action,
  example,
  id,
}: {
  action: string;
  example: "exam" | "language";
  id: string;
}) {
  const t = await getExtracted();
  const words = example === "exam" ? await getExamGoal() : await getLanguageGoal();

  return (
    <GoalForm action={action} example={words} id={id} note={t("Start free, no account needed.")} />
  );
}
