import { type Task } from "@/lib/types";
import {
  type SetupLessonOutlineParams,
  generateSetupLessonOutline,
} from "@zoonk/ai/tasks/curriculum/setup-lesson-outline";
import { type SetupLessonOutlineExpected, scoreSetupLessonOutline } from "./scorer";
import { TEST_CASES } from "./test-cases";

type SetupLessonOutlineOutput = Awaited<ReturnType<typeof generateSetupLessonOutline>>["data"];

export const setupLessonOutlineTask: Task<
  SetupLessonOutlineParams,
  SetupLessonOutlineOutput,
  SetupLessonOutlineExpected
> = {
  description:
    "Outline the short lesson that sets up a tool on the learner's device: title, description, can-do line, minutes and skill",
  generate: generateSetupLessonOutline,
  id: "setup-lesson-outline",
  name: "Setup lesson outline",
  priorities: {
    distribution: "shared",
    first: "latency",
    reads: "A lesson writer and then a learner read the new lesson outline",
    reason: "The learner waits; the cheapest that met every rule",
    waits: "A learner waits after choosing to set up a tool",
  },
  score: scoreSetupLessonOutline,
  testCases: TEST_CASES,
};
