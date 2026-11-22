import { type Task } from "@/lib/types";
import {
  type ExamResearchPlan,
  type ExamResearchPlanParams,
  generateExamResearchPlan,
} from "@zoonk/ai/tasks/research/plan";
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
  name: "Exam research plan",
  priorities: {
    distribution: "private",
    first: "cost",
    reads: "Code: search queries for the research workflow",
    reason: "Search hints only; the cheaper model scored nearly the same",
    waits: "A learner waits on a new exam goal; refreshes in the background",
  },
  score: scoreResearchPlan,
  testCases: TEST_CASES,
};
