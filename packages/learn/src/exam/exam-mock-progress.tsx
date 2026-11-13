"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownRightIcon, ArrowUpRightIcon, TimerIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { getMockSubject } from "../mock/mock-labels";
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

const SAMPLE = Array.from(
  { length: SAMPLE_MOCKS },
  (_, index) => SAMPLE_FIRST + index * SAMPLE_STEP,
);

function useMockDate() {
  const format = useFormatter();

  return (mock: ProgressMock) =>
    format.dateTime(new Date(mock.finishedAt), { day: "numeric", month: "short" });
}

function usePoints(progress: Progress): ProgressPoint[] {
  const t = useExtracted();
  const date = useMockDate();

  return progress.mocks.map((mock) => {
    const shape = getMockSubject(mock);
    const name = t("Mock exam {number}", { number: String(mock.number) });

    return {
      detail: [name, date(mock), shape].filter(Boolean).join(" · "),
      key: String(mock.number),
      label: `${mock.percent}%`,
      value: mock.percent,
    };
  });
}

/** What changed between mock exams, in one sentence, or nothing when no subject moved. */
function useProgressLine(progress: Progress): string | null {
  const t = useExtracted();
  const format = useFormatter();
  const list = (names: string[]) => format.list(names, { type: "conjunction" });
  const { improved, needsWork } = progress;

  if (improved.length > 0 && needsWork.length > 0) {
    return t("Better in {improved}. Work on {needsWork}.", {
      improved: list(improved),
      needsWork: list(needsWork),
    });
  }

  if (improved.length > 0) {
    return t("Better in {improved}.", { improved: list(improved) });
  }

  return needsWork.length > 0 ? t("Work on {needsWork}.", { needsWork: list(needsWork) }) : null;
}

function formatChange(change: number | null): string {
  if (change === null) {
    return "–";
  }

  return change > 0 ? `+${change}` : String(change);
}

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

function SubjectRow({ trend, trends }: { trend: SubjectTrend; trends: boolean }) {
  const latest = trend.percents.at(-1) ?? 0;

  return (
    <li className={cn(TITLE_ROW_CLASS, "min-h-11 py-2.5")}>
      <span className="text-sm leading-snug font-medium text-pretty">{trend.name}</span>
      <span className="flex flex-wrap items-center gap-x-3">
        <span className="flex min-w-0 items-center gap-3">
          {trends ? (
            <Sparkline values={trend.percents} />
          ) : (
            <Meter className="w-20 sm:w-36">
              <MeterFill className="bg-success" share={latest / PERCENT} />
            </Meter>
          )}
          <span className="w-10 text-right font-mono text-xs tabular-nums">{`${latest}%`}</span>
        </span>
        {trends && <SubjectChange change={trend.change} />}
      </span>
    </li>
  );
}

function useLatestMock(progress: Progress) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const first = progress.mocks[0];

  const latest =
    progress.mocks.findLast((mock) => mock.shape?.kind !== "area") ?? progress.mocks.at(-1);

  if (!latest) {
    return null;
  }

  const name = [t("Mock exam {number}", { number: String(latest.number) }), getMockSubject(latest)]
    .filter(Boolean)
    .join(" · ");

  return {
    change: first && progress.mocks.length > 1 ? latest.percent - first.percent : null,
    measure:
      exam.scoring.method === "net"
        ? t("Score in {mock}", { mock: name })
        : t("Right answers in {mock}", { mock: name }),
    percent: latest.percent,
  };
}

function LatestMock({ progress }: { progress: Progress }) {
  const t = useExtracted();
  const latest = useLatestMock(progress);

  if (!latest) {
    return null;
  }

  // One mock exam has nothing to compare: the subject rows below are its result.
  if (latest.change === null) {
    return <p className="text-muted-foreground text-compact">{latest.measure}</p>;
  }

  return (
    <StatTiles>
      <StatTile
        detail={
          <>
            {latest.measure}
            <span className={cn("block", latest.change > 0 && "text-success-text")}>
              {t("{change} since the first", { change: formatChange(latest.change) })}
            </span>
          </>
        }
        icon={<TimerIcon />}
        label={t("Latest mock exam")}
        value={`${latest.percent}%`}
      />
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
  const trends = progress.subjects.some((trend) => trend.change !== null);

  return (
    <div className="flex flex-col gap-4">
      {line && <p className="text-reading font-medium text-pretty">{line}</p>}

      <LatestMock progress={progress} />

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
    </div>
  );
}

export function ExamMockProgress() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (!exam.mocksRequirePlus && !exam.progress) {
    return null;
  }

  return (
    <PageSection aria-labelledby={TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("Your progress")}</PageSectionTitle>
        {!exam.progress && <PlusMark />}
      </PageSectionHeader>
      {exam.progress ? (
        <ProgressCard progress={exam.progress} />
      ) : (
        <div data-slot="locked-progress">
          <SampleProgressChart values={SAMPLE} />
        </div>
      )}
    </PageSection>
  );
}
