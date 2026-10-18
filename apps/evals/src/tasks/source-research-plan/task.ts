import { type Task } from "@/lib/types";
import {
  type SourceResearchPlan,
  type SourceResearchPlanParams,
  generateSourceResearchPlan,
} from "@zoonk/ai/tasks/v2/research/source-plan";
import { type ResearchPlanExpected, scoreResearchPlan } from "../research-plan/scorer";
import { TEST_CASES } from "./test-cases";

export const sourceResearchPlanTask: Task<
  SourceResearchPlanParams,
  SourceResearchPlan,
  ResearchPlanExpected
> = {
  description:
    "Name the canonical law, product or subject, where it's published, and the queries to find its current text or reference syllabi",
  generate: generateSourceResearchPlan,
  id: "source-research-plan",
  name: "Source Research Plan",
  score: scoreResearchPlan,
  testCases: TEST_CASES,
};
