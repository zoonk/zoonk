import { type Task } from "@/lib/types";
import {
  type VisualImageParams,
  type VisualImageSchema,
  generateVisualImage,
} from "@zoonk/ai/tasks/visuals/image";
import { TEST_CASES } from "./test-cases";

export const visualImageTask: Task<VisualImageParams, VisualImageSchema> = {
  description: "Generate a refined image generation prompt from a textual description",
  generate: generateVisualImage,
  id: "visual-image",
  name: "Visual Image",
  testCases: TEST_CASES,
};
