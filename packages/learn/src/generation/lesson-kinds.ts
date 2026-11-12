import { type LessonContentStepName } from "@zoonk/core/library/generation/steps";
import { type GenerationKindDefinition } from "./generation-kinds";

export const lesson = {
  phases: [
    { id: "plan", seconds: 40 },
    { id: "write", seconds: 50 },
    { id: "mark", seconds: 10 },
    { alongside: true, id: "draw", seconds: 45 },
  ],
  steps: {
    drawPictures: "draw",
    joinRunningLesson: "join",
    lessonReady: "done",
    markLesson: "mark",
    planChallenge: "aside",
    planLesson: "plan",
    redraftChallenge: "aside",
    reviewChallenge: "aside",
    writeChallenge: "aside",
    writeLesson: "write",
  },
} as const satisfies GenerationKindDefinition<
  LessonContentStepName,
  "draw" | "mark" | "plan" | "write"
>;

export const challenge = {
  phases: [
    { id: "plan", seconds: 75 },
    { id: "write", seconds: 50 },
    { id: "redraft", optional: true, seconds: 125 },
  ],
  steps: {
    drawPictures: "aside",
    joinRunningLesson: "join",
    lessonReady: "done",
    markLesson: "aside",
    planChallenge: "plan",
    planLesson: "aside",
    redraftChallenge: "redraft",
    reviewChallenge: "write",
    writeChallenge: "write",
    writeLesson: "aside",
  },
} as const satisfies GenerationKindDefinition<LessonContentStepName, "plan" | "redraft" | "write">;
