import { getExtracted } from "next-intl/server";
import { PlanIncludes } from "./plan-includes";

/**
 * What Plus gives: every goal and every lesson, then a few short lines. The offer shows it before
 * paying and a subscriber's plan shows it after, so both promise the same thing. Call minutes stay
 * off it, as on every plan: Plus has higher call limits, never a number.
 */
export async function PlusBenefits() {
  const t = await getExtracted();

  return (
    <PlanIncludes
      items={[
        { id: "exam", text: t("Your whole exam plan, every day to the exam") },
        { id: "mocks", text: t("Mock exams, timed like the real one") },
        { id: "buddy", text: t("An AI study buddy whenever you're stuck") },
        { id: "calls", text: t("Higher limits for speaking calls") },
      ]}
      summary={t("Every goal · every lesson")}
    />
  );
}
