import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getApproxDurationFormatter } from "@/lib/public/public-labels";
import { type PlanNumbers } from "@zoonk/core/plans/numbers-contract";
import { KindDot, type LearnKind } from "@zoonk/learn/kind-tile";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** A part of the plan's time: the kinds of work in it, as the app marks them on Today. */
type WorkloadPart = { id: string; kinds: LearnKind[]; label: string; minutes: number };

/**
 * What fills the plan's days at one time a day, so its headline reads against the outline's lesson
 * time: the lessons, those the course hasn't written yet (written as the learner reaches them),
 * reviews and practice, and challenges and mocks, each after its kind's dot, the one the app marks
 * it with on Today, and the whole of it beside the label, from the same plan numbers as the
 * headline. A part with no time isn't listed. The reviews' time, often as long as the lessons',
 * says what it's for. Work an exam's plan leaves for after its date (none unless it studies the
 * whole course) is said apart, since the headline counts up to it.
 */
export async function PlanWorkload({
  exam,
  numbers,
}: {
  /** An exam's plan has mock exams beside its challenges; a course's has challenges only. */
  exam: boolean;
  numbers: PlanNumbers;
}) {
  const t = await getExtracted();
  const { workload } = numbers;

  const allParts: WorkloadPart[] = [
    { id: "lessons", kinds: ["lesson"], label: t("Lessons"), minutes: workload.lessonMinutes },
    {
      id: "unwritten",
      kinds: ["lesson"],
      label: t("Lessons not written yet"),
      minutes: workload.unwrittenLessonMinutes,
    },
    {
      id: "practice",
      kinds: ["review"],
      label: t("Reviews and practice"),
      minutes: workload.practiceMinutes,
    },
    {
      id: "checkpoints",
      kinds: exam ? ["challenge", "mock"] : ["challenge"],
      label: exam ? t("Challenges and mock exams") : t("Challenges"),
      minutes: workload.checkpointMinutes,
    },
  ];

  const parts = allParts.filter((part) => Math.round(part.minutes) > 0);

  if (parts.length === 0) {
    return null;
  }

  const durationText = await getApproxDurationFormatter();
  const afterDate = Math.round(numbers.afterDeadlineMinutes ?? 0);

  return (
    <div className="flex flex-col gap-2.5 border-t pt-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-label">{t("What fills the time")}</span>

        {parts.length > 1 && (
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
            {t("{time} in all", { time: durationText(numbers.scheduledMinutes) })}
          </span>
        )}
      </p>

      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] leading-5">
        {parts.map((part) => (
          <div className="flex items-center gap-2" key={part.id}>
            <dt className="flex items-center gap-2">
              <span className="flex gap-1">
                {part.kinds.map((kind) => (
                  <KindDot key={kind} kind={kind} />
                ))}
              </span>
              {part.label}
            </dt>

            <dd className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
              {durationText(part.minutes)}
            </dd>
          </div>
        ))}
      </dl>

      {Math.round(workload.practiceMinutes) > 0 && (
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("What you studied comes back right before you'd forget it.")}
        </p>
      )}

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
