import { getExtracted } from "next-intl/server";
import { getExampleMove } from "./example-move";
import { GoalForm } from "./goal-form";

/**
 * Where a visitor writes a goal in their own words. The box shows example goals one at a time,
 * starting with the move abroad the home page's plan follows.
 */
export async function GoalBox({
  action,
  id,
  variant,
}: {
  action: string;
  id: string;
  variant: "card" | "pill";
}) {
  const [t, move] = await Promise.all([getExtracted(), getExampleMove()]);

  const examples = [
    t(
      "{move, select, london {speak English for my move to London} other {speak Spanish for my move to Madrid}}",
      { move },
    ),
    t("pass the SAT in March"),
    t("get promoted to data analyst"),
    t("keep up in calculus"),
    t("sell 12 cakes a week"),
  ];

  return <GoalForm action={action} examples={examples} id={id} variant={variant} />;
}
