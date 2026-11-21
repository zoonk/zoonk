import { type Task } from "@/lib/types";
import { type CoverageCheckParams, checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { type CoverageCheckExpected, scoreCoverageCheck } from "./scorer";
import { TEST_CASES } from "./test-cases";

type CoverageCheckOutput = Awaited<ReturnType<typeof checkCoverage>>["data"];

export const coverageCheckTask: Task<
  CoverageCheckParams,
  CoverageCheckOutput,
  CoverageCheckExpected
> = {
  description:
    "Compare a skill graph with reference syllabi and return the skills they expect but the graph misses",
  generate: checkCoverage,
  id: "coverage-check",
  name: "Coverage check",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "Code adds missing skills and exam weights to the graph",
    reason: "A gap in an exam's graph reaches every learner of the exam",
    waits: "A learner waits on a goal's curriculum; exam repairs run in the background",
  },
  score: scoreCoverageCheck,
  testCases: TEST_CASES,
};
