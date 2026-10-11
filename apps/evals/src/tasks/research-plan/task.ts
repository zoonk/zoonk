import { type Task } from "@/lib/types";
import {
  type ExamResearchPlan,
  type ExamResearchPlanParams,
  generateExamResearchPlan,
} from "@zoonk/ai/tasks/v2/research/plan";
import { type ResearchPlanExpected, scoreResearchPlan } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const researchPlanTask: Task<
  ExamResearchPlanParams,
  ExamResearchPlan,
  ResearchPlanExpected
> = {
  description:
    "Name the canonical exam (name and role), whether it's a teacher's test, where its organizer publishes, and the queries to find its notice",
  generate: generateExamResearchPlan,
  id: "research-plan",
  name: "Exam Research Plan",
  score: scoreResearchPlan,
  testCases: TEST_CASES,
};
