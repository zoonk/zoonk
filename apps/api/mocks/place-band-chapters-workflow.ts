import { placeChaptersAfterStep } from "../src/workflows/courses/steps/course-outline-steps";

export async function placeBandChaptersWorkflow(
  input: Parameters<typeof placeChaptersAfterStep>[0],
) {
  "use workflow";

  return placeChaptersAfterStep(input);
}
