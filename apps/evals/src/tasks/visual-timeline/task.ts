import { type Task } from "@/lib/types";
import {
  type VisualTimelineParams,
  type VisualTimelineSchema,
  generateVisualTimeline,
} from "@zoonk/ai/tasks/visuals/timeline";
import { TEST_CASES } from "./test-cases";

export const visualTimelineTask: Task<VisualTimelineParams, VisualTimelineSchema> = {
  description:
    "Generate structured timeline data (chronological events with dates) from a textual description",
  generate: generateVisualTimeline,
  id: "visual-timeline",
  name: "Visual Timeline",
  testCases: TEST_CASES,
};
