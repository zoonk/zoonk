import {
  TEST_OUT_QUESTIONS_READY_STEP,
  type TestOutQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItems } from "./placement-items";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

export type TestOutQuestionsInput = {
  analytics?: ContentAnalytics;
  chapterId: string;
  goalId: string;
  questionsPerSkill: number;
  skillIds: string[];
};

const TEST_OUT_FORMATS = ["multipleChoice"] as const;

/** At least a few per skill, so a retake has questions the learner hasn't seen. */
const TEST_OUT_QUESTIONS_PER_SKILL = 3;

export async function testOutQuestionsWorkflow(
  input: TestOutQuestionsInput,
): Promise<QuestionWritingResult> {
  "use workflow";

  const { analytics, chapterId, goalId, questionsPerSkill, skillIds } = input;
  const { workflowRunId } = getWorkflowMetadata();

  return runQuestionWriting<TestOutQuestionsStepName>({
    steps: {
      join: "joinTestOutQuestions",
      ready: TEST_OUT_QUESTIONS_READY_STEP,
      write: "writeTestOutQuestions",
    },
    token: `test-out-questions:${goalId}:${chapterId}`,
    write: async () => {
      const { failed, written } = await preparePlacementItems({
        analytics,
        formats: TEST_OUT_FORMATS,
        goalId,
        quickCount: Math.max(TEST_OUT_QUESTIONS_PER_SKILL, questionsPerSkill),
        quickNeeded: questionsPerSkill,
        skillIds,
        workflowRunId,
      });

      return written === 0 && failed > 0 ? "failed" : "written";
    },
  });
}
