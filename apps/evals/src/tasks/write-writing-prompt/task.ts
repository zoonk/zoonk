import { type Task } from "@/lib/types";
import {
  type WritingPromptOutput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { WRITE_WRITING_PROMPT_SCORE_CATEGORIES, scoreWriteWritingPrompt } from "./scorer";
import { TEST_CASES, type WriteWritingPromptInput } from "./test-cases";

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

export const writeWritingPromptTask: Task<WriteWritingPromptInput, WritingPromptOutput> = {
  description:
    "Write a shared practice question for one written task of an exam (or a drill on one skill), with its private keyed aspects: code checks (the production validator, aspect points adding up, unused title, ENEM competences), then a judge on board realism, key accuracy and skill fit",
  generate: async ({ model, useFallback, ...input }) => {
    const { data } = await writeWritingPrompt({
      input,
      model,
      shared: true,
      useFallback,
      wait: "soon",
    });

    return { data, systemPrompt: "", usage: NO_USAGE, userPrompt: JSON.stringify(input) };
  },
  id: "write-writing-prompt",
  name: "Write writing prompt",
  score: scoreWriteWritingPrompt,
  scoreCategories: WRITE_WRITING_PROMPT_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
