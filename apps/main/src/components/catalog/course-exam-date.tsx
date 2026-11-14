import { getIsoDayFormatter } from "@/lib/public/public-labels";
import { type CoursePlanExample } from "@zoonk/core/catalog/course-plan-example-contract";
import { addIsoDays } from "@zoonk/utils/calendar-day";
import { getExtracted, getFormatter } from "next-intl/server";

/** A fact beside the subject's chip, not a second chip. */
export async function CourseExamDate({ exam }: { exam: NonNullable<CoursePlanExample["exam"]> }) {
  const [first] = exam.days;

  if (!first) {
    return null;
  }

  const t = await getExtracted();
  const format = await getFormatter();
  const formatDay = await getIsoDayFormatter(addIsoDays({ day: first, days: -exam.daysLeft }));
  const dates = format.list(exam.days.map(formatDay), { type: "conjunction" });

  return (
    <p className="text-muted-foreground text-xs text-pretty">
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
