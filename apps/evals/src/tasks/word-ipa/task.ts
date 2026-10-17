import { type Task } from "@/lib/types";
import { type WordIpa, writeWordIpa } from "@zoonk/ai/tasks/v2/language/word-ipa";
import { scoreWordIpa } from "./scorer";
import { TEST_CASES, type WordIpaExpected } from "./test-cases";

export const wordIpaTask: Task<Parameters<typeof writeWordIpa>[0], WordIpa, WordIpaExpected> = {
  description:
    "Write how a word sounds in its language in IPA, and how English reads the same spelling when it's also an English word or name, so a voice reading the word alone says it right",
  generate: writeWordIpa,
  id: "word-ipa",
  name: "Word IPA",
  score: scoreWordIpa,
  testCases: TEST_CASES,
};
