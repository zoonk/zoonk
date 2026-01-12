import { createCourseGenerationRun } from "@/data/course-generation-runs/create-course-generation-run";

type Input = {
  runId: string;
  courseSuggestionId: number;
  title: string;
};

export async function createRunStep(input: Input): Promise<void> {
  "use step";

  await createCourseGenerationRun({
    courseSuggestionId: input.courseSuggestionId,
    runId: input.runId,
    title: input.title,
  });
}
