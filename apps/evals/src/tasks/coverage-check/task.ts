import { type Task } from "@/lib/types";
import {
  type CoverageCheckParams,
  checkCoverage,
} from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
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
  name: "Coverage Check",
  score: scoreCoverageCheck,
  testCases: TEST_CASES,
};
