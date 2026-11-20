import { type Task } from "@/lib/types";
import {
  type WriteListeningSetParams,
  writeListeningSet,
} from "@zoonk/ai/tasks/listening/write-set";
import { readCriteria } from "../plain-language-criterion";
import { WRITE_LISTENING_SET_SCORE_CATEGORIES } from "./score-categories";
import { checkWriteListeningSetOutput, scoreWriteListeningSet } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const writeListeningSetTask: Task<
  WriteListeningSetParams,
  Awaited<ReturnType<typeof writeListeningSet>>["data"]
> = {
  codeChecks: checkWriteListeningSetOutput,
  criteria: readCriteria(WRITE_LISTENING_SET_SCORE_CATEGORIES),
  description:
    "Write one listening exam recording (speakers with accents, turns) and its questions with the script words that answer them: code checks (evidence heard word for word, typed answers said, order, count, speakers, length, item checks), then a judge on exam realism, natural speech and fair questions",
  generate: writeListeningSet,
  id: "write-listening-set",
  name: "Write listening set",
  priorities: {
    comparison: {
      criteria: { examRealism: "counts", keys: "disqualifies", naturalSpeech: "counts" },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner hears the recording and answers its questions",
    reason: "Shared sets; the chosen model beat a pricier one",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  requiresAnswerKeyCheck: true,
  score: scoreWriteListeningSet,
  scoreCategories: WRITE_LISTENING_SET_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
