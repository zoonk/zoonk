import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getTotalDurationFormatter } from "@/lib/public/public-labels";
import { type PlanNumbers } from "@zoonk/core/plans/numbers-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/**
 * What fills the plan's days at one time a day, so its headline reads against the outline's lesson
 * time: the lessons, those the course hasn't written yet (written as the learner reaches them),
 * reviews and practice, and challenges and mocks, then all of it, from the same plan numbers as
 * the headline. A part with no time isn't listed. Work an exam's plan leaves for after its date
 * (none unless it studies the whole course) is said apart, since the headline counts up to it.
 */
export async function PlanWorkloadRows({
  exam,
  numbers,
}: {
  /** An exam's plan has mock exams beside its challenges; a course's has challenges only. */
  exam: boolean;
  numbers: PlanNumbers;
}) {
  const t = await getExtracted();
  const { workload } = numbers;

  const parts = [
    { id: "lessons", label: t("Lessons"), minutes: workload.lessonMinutes },
    {
      id: "unwritten",
      label: t("Lessons not written yet"),
      minutes: workload.unwrittenLessonMinutes,
    },
    { id: "practice", label: t("Reviews and practice"), minutes: workload.practiceMinutes },
    {
      id: "checkpoints",
      label: exam ? t("Challenges and mock exams") : t("Challenges"),
      minutes: workload.checkpointMinutes,
    },
  ].filter((part) => Math.round(part.minutes) > 0);

  if (parts.length === 0) {
    return null;
  }

  const durationText = await getTotalDurationFormatter();
  const afterDate = Math.round(numbers.afterDeadlineMinutes ?? 0);

  return (
    <div className="flex flex-col gap-1.5 border-t pt-4">
      <p className="text-label">{t("What fills the time")}</p>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[0.8125rem]">
        {parts.map((part) => (
          <div className="contents" key={part.id}>
            <dt className="min-w-0 text-pretty">{part.label}</dt>
            <dd className={cn(NUMERIC_CLASS, "text-muted-foreground text-right text-xs leading-5")}>
              {durationText(part.minutes)}
            </dd>
          </div>
        ))}

        {parts.length > 1 && (
          <div className="contents font-medium">
            <dt className="mt-1 border-t pt-1.5">{t("In all")}</dt>
            <dd className={cn(NUMERIC_CLASS, "mt-1 border-t pt-1.5 text-right text-xs leading-5")}>
              {durationText(numbers.scheduledMinutes)}
            </dd>
          </div>
        )}
      </dl>

      {afterDate > 0 && (
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("Of this, {time} comes after the exam.", { time: durationText(afterDate) })}
        </p>
      )}

      {workload.unwrittenLessonMinutes > 0 && (
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("Lessons not written yet are written as you reach them.")}
        </p>
      )}
    </div>
  );
}
