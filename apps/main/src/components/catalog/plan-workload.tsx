import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getTotalDurationFormatter } from "@/lib/public/public-labels";
import { type PlanNumbers } from "@zoonk/core/plans/numbers-contract";
import { KindMark, type LearnKind, kindFillClass } from "@zoonk/learn/kind-tile";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

type WorkloadPart = {
  fill: string;
  id: string;
  kinds: LearnKind[];
  label: string;
  minutes: number;
};

export async function PlanWorkload({ exam, numbers }: { exam: boolean; numbers: PlanNumbers }) {
  const t = await getExtracted();
  const { workload } = numbers;

  const allParts: WorkloadPart[] = [
    {
      fill: "bg-foreground/45",
      id: "lessons",
      kinds: ["lesson"],
      label: t("Lessons"),
      minutes: workload.lessonMinutes,
    },
    {
      fill: "bg-foreground/20",
      id: "unwritten",
      kinds: ["lesson"],
      label: t("Lessons not written yet"),
      minutes: workload.unwrittenLessonMinutes,
    },
    {
      fill: kindFillClass("review"),
      id: "practice",
      kinds: ["review"],
      label: t("Reviews and practice"),
      minutes: workload.practiceMinutes,
    },
    {
      fill: kindFillClass("challenge"),
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

  const durationText = await getTotalDurationFormatter();
  const afterDate = Math.round(numbers.afterDeadlineMinutes ?? 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold">{t("What fills the time")}</span>

        {parts.length > 1 && (
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
            {t("{time} in all", { time: durationText(numbers.scheduledMinutes) })}
          </span>
        )}
      </p>

      {parts.length > 1 && (
        <MeterParts className="h-2">
          {parts.map((part) => (
            <MeterPart className={part.fill} key={part.id} weight={part.minutes} />
          ))}
        </MeterParts>
      )}

      <dl className="flex flex-col gap-2.5 pt-1 text-sm leading-5">
        {parts.map((part) => (
          <div className="flex items-center gap-3" key={part.id}>
            <dt className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex gap-1">
                {part.kinds.map((kind) => (
                  <KindMark key={kind} kind={kind} />
                ))}
              </span>
              <span className="text-pretty">{part.label}</span>
            </dt>

            <dd className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
              {durationText(part.minutes)}
            </dd>
          </div>
        ))}
      </dl>

      {Math.round(workload.practiceMinutes) > 0 && (
        <p className="text-muted-foreground pt-1 text-[13px] leading-relaxed text-pretty">
          {t("What you studied comes back right before you'd forget it.")}
        </p>
      )}

      {afterDate > 0 && (
        <p className="text-muted-foreground text-[13px] leading-relaxed text-pretty">
          {t("Of this, {time} comes after the exam.", { time: durationText(afterDate) })}
        </p>
      )}

      {workload.unwrittenLessonMinutes > 0 && (
        <p className="text-muted-foreground text-[13px] leading-relaxed text-pretty">
          {t("Lessons not written yet are written as you reach them.")}
        </p>
      )}
    </div>
  );
}
