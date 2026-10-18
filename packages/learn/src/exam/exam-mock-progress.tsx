"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownRightIcon, ArrowUpRightIcon, TimerIcon, TrophyIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { useMockShapeLabel } from "../mock/mock-labels";
import { findBestArea } from "./best-area";
import { useExamScreen } from "./exam-context";
import {
  ProgressLineChart,
  type ProgressPoint,
  SampleProgressChart,
  Sparkline,
} from "./mock-progress-chart";

type Progress = NonNullable<ExamView["progress"]>;
type ProgressMock = Progress["mocks"][number];
type SubjectTrend = Progress["subjects"][number];

const TITLE_ID = "exam-progress-title";

const PERCENT = 100;

const SAMPLE_MOCKS = 6;
const SAMPLE_FIRST = 30;
const SAMPLE_STEP = 7;

/** A sample of what the chart shows, behind the Plus mark: scores rising mock after mock. */
const SAMPLE = Array.from(
  { length: SAMPLE_MOCKS },
  (_, index) => SAMPLE_FIRST + index * SAMPLE_STEP,
);

function useMockDate() {
  const format = useFormatter();

  return (mock: ProgressMock) =>
    format.dateTime(new Date(mock.finishedAt), { day: "numeric", month: "short" });
}

/** What the chart's points say: the score, then the mock, its day and what it sat. */
function usePoints(progress: Progress): ProgressPoint[] {
  const t = useExtracted();
  const date = useMockDate();
  const shapeLabel = useMockShapeLabel();

  return progress.mocks.map((mock) => {
    const shape = shapeLabel(mock);
    const name = t("Mock exam {number}", { number: String(mock.number) });

    return {
      detail: [name, date(mock), shape].filter(Boolean).join(" · "),
      key: String(mock.number),
      label: `${mock.percent}%`,
      value: mock.percent,
    };
  });
}

/**
 * One plain line about what improved and what still needs work, that nothing moved much, or what a
 * trend still waits for.
 */
function useProgressLine(progress: Progress): string {
  const t = useExtracted();
  const format = useFormatter();
  const list = (names: string[]) => format.list(names, { type: "conjunction" });
  const { improved, mocks, needsWork } = progress;

  if (mocks.length < 2) {
    return t("Take another mock exam to see how your score changes.");
  }

  if (improved.length > 0 && needsWork.length > 0) {
    return t("Better in {improved}. Still needs work: {needsWork}.", {
      improved: list(improved),
      needsWork: list(needsWork),
    });
  }

  if (improved.length > 0) {
    return t("Better in {improved}.", { improved: list(improved) });
  }

  if (needsWork.length > 0) {
    return t("Still needs work: {needsWork}.", { needsWork: list(needsWork) });
  }

  // A subject's trend needs two mocks with enough new questions of it.
  return progress.subjects.some((trend) => trend.change !== null)
    ? t("No subject has changed much yet.")
    : t("Trends by subject show once your mocks ask enough new questions of each one.");
}

/** "+12" or "-8" points since the subject's first mock; a dash until a second mock asks it. */
function formatChange(change: number | null): string {
  if (change === null) {
    return "–";
  }

  return change > 0 ? `+${change}` : String(change);
}

/** A subject's change since its first mock, as an arrow and the points. */
function SubjectChange({ change }: { change: number | null }) {
  const t = useExtracted();
  const Icon = change !== null && change < 0 ? ArrowDownRightIcon : ArrowUpRightIcon;

  return (
    <span className="flex w-12 items-center justify-end gap-0.5 font-mono text-xs font-medium tabular-nums">
      {change !== null && change !== 0 && (
        <Icon aria-hidden="true" className="text-muted-foreground size-3.5" />
      )}
      {change !== null && <span className="sr-only">{t("Since the first mock:")}</span>}
      <span className={cn(change === null && "text-muted-foreground font-normal")}>
        {formatChange(change)}
      </span>
    </span>
  );
}

/**
 * A subject's latest share, with its line and its change since the first mock once some subject
 * has them: before that, a one-dot line and a dash on every row would say nothing.
 */
function SubjectRow({ trend, trends }: { trend: SubjectTrend; trends: boolean }) {
  const latest = trend.percents.at(-1) ?? 0;

  return (
    <li className="flex min-h-11 items-center gap-3">
      <span className="min-w-0 flex-1 py-2.5 text-sm leading-snug font-medium text-pretty">
        {trend.name}
      </span>
      {trends ? (
        <Sparkline values={trend.percents} />
      ) : (
        <Meter className="bg-surface-3 h-1 w-20 rounded-[2px] sm:w-36">
          <MeterFill className="bg-success rounded-[2px]" share={latest / PERCENT} />
        </Meter>
      )}
      <span className="w-10 text-right font-mono text-xs tabular-nums">{`${latest}%`}</span>
      {trends && <SubjectChange change={trend.change} />}
    </li>
  );
}

/**
 * The progress in two numbers: the latest mock over the exam (all of it, half of it, the plan's own
 * or a starting point) with what it measures (one subject's few questions never stand for the
 * exam; a subject's own mock leads only when there's no other, named with its subject) and its
 * change since the first, and the subject that went best in it. How many mocks were taken is the
 * section's count.
 */
function ProgressTiles({ progress }: { progress: Progress }) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const shapeLabel = useMockShapeLabel();
  const first = progress.mocks[0];
  const best = findBestArea(progress.subjects);

  const latest =
    progress.mocks.findLast((mock) => mock.shape?.kind !== "area") ?? progress.mocks.at(-1);

  if (!latest) {
    return null;
  }

  const name = [
    t("Mock exam {number}", { number: String(latest.number) }),
    latest.shape?.kind === "area" ? shapeLabel(latest) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const change = first && progress.mocks.length > 1 ? latest.percent - first.percent : null;

  return (
    <StatTiles>
      <StatTile
        detail={
          <>
            {exam.scoring.method === "net"
              ? t("Net score in {mock}", { mock: name })
              : t("Right answers in {mock}", { mock: name })}
            {change !== null && (
              <span className={cn("block", change > 0 && "text-success-text")}>
                {t("{change} since the first", { change: formatChange(change) })}
              </span>
            )}
          </>
        }
        icon={<TimerIcon />}
        label={t("Latest mock")}
        value={`${latest.percent}%`}
      />
      {best && (
        <StatTile
          detail={best.name}
          icon={<TrophyIcon />}
          label={t("Best area")}
          tone="success"
          value={`${best.percent}%`}
        />
      )}
    </StatTiles>
  );
}

function ProgressCard({ progress }: { progress: Progress }) {
  const t = useExtracted();
  const date = useMockDate();
  const points = usePoints(progress);
  const line = useProgressLine(progress);
  const first = progress.mocks[0];
  const latest = progress.mocks.at(-1);
  // A subject's change needs two mocks asking enough new questions of it.
  const trends = progress.subjects.some((trend) => trend.change !== null);

  return (
    <div className="flex flex-col gap-4">
      <ProgressTiles progress={progress} />

      {first && latest && progress.mocks.length > 1 && (
        <ProgressLineChart
          first={date(first)}
          label={t("Your mock exam scores, from {first}% to {latest}%", {
            first: String(first.percent),
            latest: String(latest.percent),
          })}
          latest={date(latest)}
          points={points}
        />
      )}

      {progress.subjects.length > 0 && (
        <ul
          aria-label={t("By subject")}
          className="flex flex-col [&>li+li]:border-t"
          data-slot="subject-trends"
        >
          {progress.subjects.map((trend) => (
            <SubjectRow key={trend.name} trend={trend} trends={trends} />
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-[0.8125rem] text-pretty">{line}</p>
    </div>
  );
}

/**
 * Without Plus, the progress shows as it would, a sample line under the Plus mark, so the learner
 * sees what it gives; the section's one notice says how to get it.
 */
function LockedProgress() {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3" data-slot="locked-progress">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm text-pretty">
          {t("Each mock's score over time, and how each subject is going.")}
        </p>
        <PlusMark />
      </div>
      <SampleProgressChart values={SAMPLE} />
    </div>
  );
}

/**
 * How the learner's mocks went, under its own header: the latest score and the best subject as two
 * numbers, each mock's score as a line once there are two, each subject's score (a bar, or its
 * trend once mocks show one), and under them one plain line about what improved and what still
 * needs work. With Plus only; without it, shown locked. Nothing before the first mock.
 */
export function ExamMockProgress() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (!exam.mocksRequirePlus && !exam.progress) {
    return null;
  }

  return (
    <PageSection aria-labelledby={TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("How your mocks went")}</PageSectionTitle>
      </PageSectionHeader>
      {exam.progress ? <ProgressCard progress={exam.progress} /> : <LockedProgress />}
    </PageSection>
  );
}
