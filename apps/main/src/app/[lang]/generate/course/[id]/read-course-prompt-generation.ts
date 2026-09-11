"use server";

import { getCoursePromptGeneration } from "@zoonk/core/courses/get-prompt-generation";

/** Reads durable readiness when an identity match hands generation to another run. */
export async function readCoursePromptGeneration(coursePromptId: string) {
  return getCoursePromptGeneration({ coursePromptId });
}
