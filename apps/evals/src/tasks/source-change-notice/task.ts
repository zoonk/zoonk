import { type Task } from "@/lib/types";
import {
  type SourceChangeNoticeParams,
  generateSourceChangeNotice,
} from "@zoonk/ai/tasks/research/source-change-notice";
import { PLAIN_LANGUAGE_CRITERION } from "../plain-language-criterion";
import { TEST_CASES } from "./test-cases";

export const sourceChangeNoticeTask: Task<SourceChangeNoticeParams, { message: string }> = {
  criteria: [PLAIN_LANGUAGE_CRITERION],
  description: "Write the one line learners see on Today when a source they study changed",
  generate: generateSourceChangeNotice,
  id: "source-change-notice",
  name: "Source change notice",
  priorities: {
    comparison: { criteria: { plainLanguage: "counts" }, preference: "separates", trade: null },
    distribution: "shared",
    first: "cost",
    reads: "A learner reads notices on their goal's news",
    reason: "Code doesn't say why its model was chosen",
    waits: "Nobody: background work",
  },
  testCases: TEST_CASES,
};
