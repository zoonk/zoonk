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
  description: "Rewrite safety-rejected image inputs so image generation can retry safely",
  generate: rewriteImageInputForSafetyRetry,
  id: "image-input-safety-rewrite",
  name: "Image Input Safety Rewrite",
  testCases: TEST_CASES,
};
