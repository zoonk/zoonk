import { type MockPurpose, type MockResult, type MockShape } from "../../mocks/mock-contract";
import { type ExamMockProgress, type ExamSubjectTrend } from "../exam-view-contract";

/** A subject's change counts as better from this many points up; less is a mock's noise. */
const IMPROVED_POINTS = 10;

/** A subject below this share right in its latest mock still needs work. */
const NEEDS_WORK_PERCENT = 60;

/** The plain line names at most this many subjects each way. */
const MAX_NAMED = 2;

/**
 * A subject a mock asked fewer questions of says too little about it to chart: below ten, one
 * answer moves its share by more than ten points, the change that reads as better.
 */
const MIN_SUBJECT_QUESTIONS = 10;

/** A mock that repeated more than this share of its questions measures memory, not the subject. */
const MAX_REUSED_SHARE = 0.5;

/** The chart shows the latest mocks, enough to see a trend at a glance. */
export const MOCK_PROGRESS_SIZE = 20;

const PERCENT = 100;

/** A finished mock in the goal's order, with what it showed. */
export type ProgressMock = {
  finishedAt: Date;
  number: number;
  purpose: MockPurpose;
  result: MockResult;
  /** Questions it repeated that the learner answered before (see `MockConditions.reused`). */
  reused: number;
  shape: MockShape | null;
};

function toPercent({ part, whole }: { part: number; whole: number }): number {
  return whole > 0 ? Math.round((part / whole) * PERCENT) : 0;
}

/** A mock's score as a share of its questions: right answers, or Cebraspe's net (right minus wrong). */
function getMockPercent(result: MockResult): number {
  const part = result.scoring === "net" && result.net ? result.net.net : result.correct;
  return toPercent({ part, whole: result.total });
}

/** Whether a mock asked mostly new questions, so its subjects' shares say how each is going. */
function isMostlyNew(mock: ProgressMock): boolean {
  return mock.reused <= mock.result.total * MAX_REUSED_SHARE;
}

/**
 * Each subject the mocks asked, in the order it first came up, with its share right in each mock
 * that holds enough evidence for it: mostly new questions, and at least `MIN_SUBJECT_QUESTIONS` of
 * the subject. A trend needs two of those, so a subject with less shows no change.
 */
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

/** The subjects that went up the most since their first mock, by at least `IMPROVED_POINTS`. */
function listImproved(trends: readonly ExamSubjectTrend[]): string[] {
  return trends
    .filter((trend) => trend.change !== null && trend.change >= IMPROVED_POINTS)
    .toSorted((first, second) => (second.change ?? 0) - (first.change ?? 0))
    .slice(0, MAX_NAMED)
    .map((trend) => trend.name);
}

/**
 * The weakest subjects in their latest mock, below `NEEDS_WORK_PERCENT`, leaving out the ones
 * already getting better: the line says what to work on next.
 */
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

/**
 * How the learner's mocks went over time: each one's score as a share of its questions (the latest
 * ones, oldest first), each subject's share right mock by mock, the subjects that got better and
 * the ones that still need work. Null before the first finished mock.
 */
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
