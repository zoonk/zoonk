import { EYEBROW_CLASS } from "@/components/public/landing-styles";
import { getIsoDayFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { type CoursePlanExample } from "./course-plan";

/**
 * An exam course's next sitting over its name, "Exam on Nov 8 and Nov 15 · 26 days left", from the
 * days the course start and its plan use; "Exam around…" while they're estimated from past
 * editions.
 */
export async function CourseExamEyebrow({
  exam,
}: {
  exam: NonNullable<CoursePlanExample["exam"]>;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const formatDay = await getIsoDayFormatter();
  const dates = format.list(exam.days.map(formatDay), { type: "conjunction" });

  return (
    <p className={cn(EYEBROW_CLASS, "mt-4")}>
      {exam.estimated
        ? t(
            "Exam around {dates} · {days, plural, =0 {today} one {about # day left} other {about # days left}}",
            { dates, days: exam.daysLeft },
          )
        : t("Exam on {dates} · {days, plural, =0 {today} one {# day left} other {# days left}}", {
            dates,
            days: exam.daysLeft,
          })}
    </p>
  );
}
