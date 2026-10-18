import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type ExamDateFinding,
  type FindExamDateParams,
  findExamDate,
} from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { TEST_CASES } from "./test-cases";

export type FindExamDateExpected = {
  /** The notice's first exam day, when it's published and known. */
  firstDate?: string;
  /** The month of the first exam day, when only that is certain. */
  month?: string;
  /** Where the organizer publishes: an official day must come from one of them. */
  officialDomains: string[];
  /** `any` when the notice may or may not be out: only an unsourced day is wrong. */
  status: "any" | "notOfficial" | "official";
};

function parseOutput(output: string): ExamDateFinding | null {
  try {
    return JSON.parse(output) as ExamDateFinding;
  } catch {
    return null;
  }
}

function isOnDomain({ domains, url }: { domains: string[]; url: string }): boolean {
  const hostname = URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : "";
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/** What's wrong with an official answer: its day, or a source off the organizer's sites. */
function checkOfficial({
  expected,
  found,
}: {
  expected: FindExamDateExpected;
  found: Extract<ExamDateFinding, { status: "official" }>;
}): string[] {
  const first = found.dates[0]?.date ?? "";

  return [
    expected.firstDate && first !== expected.firstDate && `first day ${first}`,
    expected.month && !first.startsWith(expected.month) && `first day ${first}`,
    !isOnDomain({ domains: expected.officialDomains, url: found.source.url }) &&
      `source ${found.source.url}`,
  ].filter((problem) => typeof problem === "string");
}

/**
 * 10 when the answer is what the notice says (or, without a notice, no day at all); 6 when it
 * gives a wrong or unsourced day, the one mistake that misleads a learner; 8 when it misses a
 * published day, which only leaves the date to be confirmed.
 */
const scoreExamDate: TaskScorer<FindExamDateExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  if (found.status !== "official") {
    return expected.status === "official"
      ? createFixedScore({ conclusion: `Missed the published day (${found.status})`, score: 8 })
      : createFixedScore({ conclusion: "None", score: 10 });
  }

  if (expected.status === "notOfficial") {
    return createFixedScore({ conclusion: "Gave a day for a test learners book", score: 6 });
  }

  const problems = checkOfficial({ expected, found });

  return problems.length === 0
    ? createFixedScore({ conclusion: "None", score: 10 })
    : createFixedScore({ conclusion: problems.join("; "), score: 6 });
};

export const findExamDateTask: Task<FindExamDateParams, ExamDateFinding, FindExamDateExpected> = {
  description:
    "Look up the official day of an exam a learner just named, with the official page it came from, or say it isn't known yet",
  generate: findExamDate,
  id: "find-exam-date",
  latencyBudget: { p50: 20, p95: 30 },
  name: "Find Exam Date",
  score: scoreExamDate,
  testCases: TEST_CASES,
};
