import { type Task } from "@/lib/types";
import {
  type VisualMusicParams,
  type VisualMusicSchema,
  generateVisualMusic,
} from "@zoonk/ai/tasks/visuals/music";
import { TEST_CASES } from "./test-cases";

export const visualMusicTask: Task<VisualMusicParams, VisualMusicSchema> = {
  description:
    "Generate structured music notation data (ABC notation and description) from a textual description",
  generate: generateVisualMusic,
  id: "visual-music",
  name: "Visual Music",
  testCases: TEST_CASES,
};
