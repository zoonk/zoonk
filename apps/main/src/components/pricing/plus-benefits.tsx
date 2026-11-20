import { getExtracted } from "next-intl/server";
import { PlanIncludes } from "./plan-includes";

/** Call minutes stay off it, with or without Plus: Plus has higher call limits, never a number. */
export async function PlusBenefits({ summaryAs }: { summaryAs?: "card" | "section" }) {
  const t = await getExtracted();

  return (
    <PlanIncludes
      items={[
        { id: "plan", text: t("Your whole study plan, every day to your deadline") },
        { id: "mocks", text: t("Mock exams, timed like the real one") },
        { id: "buddy", text: t("An AI study buddy whenever you're stuck") },
        { id: "calls", text: t("More speaking practice calls") },
        { id: "certificates", text: t("A certificate for every level you finish") },
      ]}
      summary={t("Every goal · every lesson")}
      summaryAs={summaryAs}
    />
  );
}
