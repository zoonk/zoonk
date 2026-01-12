import { createCourseGenerationRun } from "@/data/course-generation-runs/create-course-generation-run";

import { streamStatus } from "../stream-status";

type Input = {
  runId: string;
  courseSuggestionId: number;
  title: string;
};

export async function createRunStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "createRun" });

  await createCourseGenerationRun({
    courseSuggestionId: input.courseSuggestionId,
    runId: input.runId,
    title: input.title,
  });

  await streamStatus({ status: "completed", step: "createRun" });
}
