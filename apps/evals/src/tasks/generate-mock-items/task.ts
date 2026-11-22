import { type Task } from "@/lib/types";
import { generateItems } from "@zoonk/ai/tasks/items/generate";
import { scoreMockItems } from "./scorer";
import { type GenerateMockItemsExpected, TEST_CASES } from "./test-cases";

type GenerateMockItemsInput = (typeof TEST_CASES)[number]["userInput"];

export const generateMockItemsTask: Task<
  GenerateMockItemsInput,
  Awaited<ReturnType<typeof generateItems>>["data"],
  GenerateMockItemsExpected
> = {
  description:
    "Write mock-exam items for a board: code checks, then a judge from another family reads them mixed blind with released questions it wasn't shown, answering each, rating its difficulty and guessing which are real",
  generate: (input) => generateItems({ ...input, country: input.country ?? null, purpose: "mock" }),
  id: "generate-mock-items",
  name: "Generate mock items",
  score: scoreMockItems,
  skippedLanguages: {
    en: "the released papers it compares against are Brazilian boards' and in Portuguese, so an English case would show the judge which questions are written",
  },
  testCases: TEST_CASES,
};
