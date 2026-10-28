import { type MockPurpose, type MockResult, type MockShape } from "../../mocks/mock-contract";
import { type ExamMockProgress, type ExamSubjectTrend } from "../exam-view-contract";

const IMPROVED_POINTS = 10;

const NEEDS_WORK_PERCENT = 60;

const MAX_NAMED = 2;

/** Below ten questions, one answer exceeds the ten-point improvement threshold. */
const MIN_SUBJECT_QUESTIONS = 10;

const MAX_REUSED_SHARE = 0.5;

export const MOCK_PROGRESS_SIZE = 20;

const PERCENT = 100;

export type ProgressMock = {
  finishedAt: Date;
  number: number;
  purpose: MockPurpose;
  result: MockResult;
  reused: number;
  shape: MockShape | null;
};

function toPercent({ part, whole }: { part: number; whole: number }): number {
  return whole > 0 ? Math.round((part / whole) * PERCENT) : 0;
}

function getMockPercent(result: MockResult): number {
  const part = result.scoring === "net" && result.net ? result.net.net : result.correct;
  return toPercent({ part, whole: result.total });
}

function isMostlyNew(mock: ProgressMock): boolean {
  return mock.reused <= mock.result.total * MAX_REUSED_SHARE;
}

function getSubjectTrends(mocks: readonly ProgressMock[]): ExamSubjectTrend[] {
  const asked = mocks
    .filter((mock) => isMostlyNew(mock))
    .flatMap((mock) =>
      mock.result.areas
        .filter((area) => area.total >= MIN_SUBJECT_QUESTIONS)
        .map((area) => ({
          name: area.name,
          percent: toPercent({ part: area.correct, whole: area.total }),
        })),
    );

  return [...Map.groupBy(asked, (entry) => entry.name)].map(([name, entries]) => {
    const percents = entries.map((entry) => entry.percent);
    const change = percents.length > 1 ? (percents.at(-1) ?? 0) - (percents[0] ?? 0) : null;

    return { change, name, percents };
  });
}

function getLatest(trend: ExamSubjectTrend): number {
  return trend.percents.at(-1) ?? 0;
}

function listImproved(trends: readonly ExamSubjectTrend[]): string[] {
  return trends
    .filter((trend) => trend.change !== null && trend.change >= IMPROVED_POINTS)
    .toSorted((first, second) => (second.change ?? 0) - (first.change ?? 0))
    .slice(0, MAX_NAMED)
    .map((trend) => trend.name);
}

function listNeedsWork({
  improved,
  trends,
}: {
  improved: readonly string[];
  trends: readonly ExamSubjectTrend[];
}): string[] {
  return trends
    .filter((trend) => getLatest(trend) < NEEDS_WORK_PERCENT && !improved.includes(trend.name))
    .toSorted((first, second) => getLatest(first) - getLatest(second))
    .slice(0, MAX_NAMED)
    .map((trend) => trend.name);
}

export function getMockProgress(mocks: readonly ProgressMock[]): ExamMockProgress | null {
  if (mocks.length === 0) {
    return null;
  }

  const recent = mocks.slice(-MOCK_PROGRESS_SIZE);
  const subjects = getSubjectTrends(recent);
  const improved = listImproved(subjects);

  return {
    improved,
    mocks: recent.map((mock) => ({
      finishedAt: mock.finishedAt.toISOString(),
      number: mock.number,
      percent: getMockPercent(mock.result),
      purpose: mock.purpose,
      shape: mock.shape,
    })),
    needsWork: listNeedsWork({ improved, trends: subjects }),
    subjects,
  };
}
