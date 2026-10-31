import { BigQuantity } from "@zoonk/learn/big-quantity";
import { LevelLadder } from "@zoonk/learn/level-ladder";
import { Meter, MeterFill } from "@zoonk/learn/meter";
import { PAGE_SECTION_TITLE_CLASS } from "@zoonk/learn/page";
import { LessonCells } from "@zoonk/learn/progress-cells";
import { formatGoalProgress } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ExampleGoal, getExampleSet } from "./landing-examples";
import { type DayState } from "./tomorrow-steps";

const JOB_PROGRESS = { known: 10, studied: 33, total: 220 };

const JOB_TODAY: Record<DayState, number> = { missed: 2, studied: 1 };

const STUDIED_POINT = 0.01;

const MOVE_LEVELS = "A2 → B1";

export async function GoalMeasure({ day, goal }: { day: DayState; goal: ExampleGoal }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const percent = (share: number) => format.number(share, { style: "percent" });

  if (goal === "move") {
    return (
      <>
        <p className={PAGE_SECTION_TITLE_CLASS}>{t("Level")}</p>
        <p className="text-readout text-[1.75rem]">{MOVE_LEVELS}</p>
        <LevelLadder label="A2" target="B1" />
        <p className="text-muted-foreground text-[0.8125rem] leading-snug text-pretty">
          {t("Next: renting, banking, the first week at work")}
        </p>
      </>
    );
  }

  if (goal === "job") {
    const studied = JOB_PROGRESS.studied + (day === "studied" ? 1 : 0);
    const done = JOB_PROGRESS.known + studied;

    return (
      <>
        <p className={PAGE_SECTION_TITLE_CLASS}>{t("Progress")}</p>
        <p>
          <BigQuantity className="text-[1.75rem]">
            {formatGoalProgress({ format, share: done / JOB_PROGRESS.total })}
          </BigQuantity>
        </p>
        <LessonCells
          known={JOB_PROGRESS.known}
          studied={studied}
          today={JOB_TODAY[day]}
          total={JOB_PROGRESS.total}
        />
        <p className="text-muted-foreground text-[0.8125rem]">
          {t(
            "{count, plural, =0 {# of {total, number} lessons} one {# of {total, number} lessons} other {# of {total, number} lessons}}",
            { count: done, total: JOB_PROGRESS.total },
          )}
        </p>
      </>
    );
  }

  const studiedYesterday = new Set(set.exam.today.map((lesson) => lesson.subject.id));

  const subjects = set.exam.subjects.map((subject) => ({
    ...subject,
    share:
      day === "studied" && studiedYesterday.has(subject.id)
        ? subject.share + STUDIED_POINT
        : subject.share,
  }));

  const preparation = subjects.reduce((sum, subject) => sum + subject.share, 0) / subjects.length;

  return (
    <>
      <p className={PAGE_SECTION_TITLE_CLASS}>{t("Preparation")}</p>
      <p>
        <BigQuantity className="text-[1.75rem]">{percent(preparation)}</BigQuantity>
      </p>
      <ul className="flex flex-col gap-2.5 pt-1">
        {subjects.map((subject) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2.5 text-[0.8125rem]"
            key={subject.id}
          >
            <span className="min-w-0 text-pretty">{subject.name}</span>
            <Meter className="h-1">
              <MeterFill className="bg-success" share={subject.share} />
            </Meter>
            <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
              {percent(subject.share)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
