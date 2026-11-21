import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type WritingPromptOutput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { readCriteria } from "../plain-language-criterion";
import {
  WRITE_WRITING_PROMPT_SCORE_CATEGORIES,
  checkWriteWritingPrompt,
  scoreWriteWritingPrompt,
} from "./scorer";
import { TEST_CASES, type WriteWritingPromptInput } from "./test-cases";

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

export const writeWritingPromptTask: Task<WriteWritingPromptInput, WritingPromptOutput> = {
  codeChecks: checkWriteWritingPrompt,
  criteria: readCriteria(WRITE_WRITING_PROMPT_SCORE_CATEGORIES),
  description:
    "Write a shared practice question for one written task of an exam (or a drill on one skill), with its private keyed aspects: code checks (the production validator, aspect points adding up, unused title, ENEM competences), then a judge on board realism, key accuracy and skill fit",
  generate: async ({ model, reasoning, useFallback, ...input }) => {
    const result = await writeWritingPrompt({
      input,
      model,
      reasoning,
      shared: true,
      useFallback,
      wait: "soon",
    });

    return { ...result, usage: result.usage ?? NO_USAGE };
  },
  id: "write-writing-prompt",
  name: "Write writing prompt",
  priorities: {
    comparison: {
      criteria: { fit: "counts", key: "counts", realism: "counts" },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
      weights: { key: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "Learners answer the question and grading uses the private key",
    reason: "A misleading command or wrong key affects every learner who practices the question",
    waits: "Usually prepared ahead, but learners can wait when a question is missing",
  },
  requiresAnswerKeyCheck: true,
  score: scoreWriteWritingPrompt,
  scoreCategories: WRITE_WRITING_PROMPT_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
