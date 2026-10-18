import { type Task } from "@/lib/types";
import {
  type WriteListeningSetParams,
  writeListeningSet,
} from "@zoonk/ai/tasks/v2/listening/write-set";
import { WRITE_LISTENING_SET_SCORE_CATEGORIES } from "./score-categories";
import { scoreWriteListeningSet } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const writeListeningSetTask: Task<
  WriteListeningSetParams,
  Awaited<ReturnType<typeof writeListeningSet>>["data"]
> = {
  description:
    "Write one listening exam recording (speakers with accents, turns) and its questions with the script words that answer them: code checks (evidence heard word for word, typed answers said, order, count, speakers, length, item checks), then a judge on exam realism, natural speech and fair questions",
  generate: writeListeningSet,
  id: "write-listening-set",
  name: "Write Listening Set",
  score: scoreWriteListeningSet,
  scoreCategories: WRITE_LISTENING_SET_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
