import { type Task } from "@/lib/types";
import {
  type ImageInputSafetyRewriteParams,
  type ImageInputSafetyRewriteSchema,
  rewriteImageInputForSafetyRetry,
} from "@zoonk/ai/tasks/images/input-safety-rewrite";
import { TEST_CASES } from "./test-cases";

export const imageInputSafetyRewriteTask: Task<
  ImageInputSafetyRewriteParams,
  ImageInputSafetyRewriteSchema
> = {
  criteria: [],
  description: "Rewrite safety-rejected image inputs so image generation can retry safely",
  generate: rewriteImageInputForSafetyRetry,
  id: "image-input-safety-rewrite",
  name: "Image input safety rewrite",
  priorities: {
    comparison: { criteria: {}, preference: "separates", trade: null },
    distribution: "shared",
    first: "cost",
    reads: "An image model reads the rewritten prompt on a retry",
    reason: "Code doesn't say why its model was chosen",
    waits: "Same as the picture it retries; code doesn't say",
  },
  testCases: TEST_CASES,
};
