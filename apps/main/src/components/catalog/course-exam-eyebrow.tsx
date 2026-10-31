import { EYEBROW_CLASS } from "@/components/public/landing-styles";
import { getFormatter } from "@/i18n/formatter";
import { getIsoDayFormatter } from "@/lib/public/public-labels";
import { type CoursePlanExample } from "@zoonk/core/catalog/course-plan-example-contract";
import { getExtracted } from "next-intl/server";

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
    <p className={EYEBROW_CLASS}>
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
