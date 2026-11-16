import { getIsoDayFormatter } from "@/lib/public/public-labels";
import { type CoursePlanExample } from "@zoonk/core/catalog/course-plan-example-contract";
import { DaysLeft } from "@zoonk/learn/days-left";
import { FactSegments } from "@zoonk/learn/facts";
import { addIsoDays } from "@zoonk/utils/calendar-day";
import { getExtracted, getFormatter } from "next-intl/server";

/** The exam's days and the time left, as the facts under the course's title. */
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
    <p className="text-muted-foreground mt-3 text-sm text-pretty">
      <FactSegments
        extra={<DaysLeft days={exam.daysLeft} estimated={exam.estimated} />}
        facts={[
          exam.estimated ? t("Exam around {dates}", { dates }) : t("Exam on {dates}", { dates }),
        ]}
      />
    </p>
  );
}
