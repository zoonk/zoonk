import { type Task } from "@/lib/types";
import {
  type SourceChangeNoticeParams,
  generateSourceChangeNotice,
} from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { TEST_CASES } from "./test-cases";

export const sourceChangeNoticeTask: Task<SourceChangeNoticeParams, { message: string }> = {
  description: "Write the one line learners see on Today when a source they study changed",
  generate: generateSourceChangeNotice,
  id: "source-change-notice",
  name: "Source Change Notice",
  testCases: TEST_CASES,
};
