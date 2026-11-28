import { type Task } from "@/lib/types";
import {
  type MemberCoverage,
  type MemberCoverageParams,
  checkMemberCoverage,
} from "@zoonk/ai/tasks/curriculum/member-coverage";
import { type MemberCoverageExpected, scoreMemberCoverage } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const memberCoverageTask: Task<
  MemberCoverageParams,
  MemberCoverage,
  MemberCoverageExpected
> = {
  description:
    "List every member of the complete list a goal names and return the ones its skill graph doesn't teach",
  generate: checkMemberCoverage,
  id: "member-coverage",
  name: "Member coverage",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "Code adds a skill for each uncovered member to the graph or offers it to the plan",
    reason: "A dropped member leaves a learner unable to finish the goal; code checks the answer",
    waits:
      "A learner waits on a goal's curriculum; the sweep of saved plans runs in the background",
  },
  score: scoreMemberCoverage,
  testCases: TEST_CASES,
};
