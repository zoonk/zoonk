import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type StorySteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateStoryContent"
  | "generateStoryChoices"
  | "generateStepImages"
  | "saveStoryActivity";

export const STORY_PHASE_STEPS = {
  buildingScenario: ["generateStoryContent"],
  creatingAnswerOptions: ["generateStoryChoices"],
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  saving: ["saveStoryActivity"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateStory = AssertAllCovered<
  Exclude<StorySteps, (typeof STORY_PHASE_STEPS)[keyof typeof STORY_PHASE_STEPS][number]>
>;

export const STORY_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "buildingScenario",
  "creatingAnswerOptions",
  "creatingImages",
  "saving",
];
