import { placeChaptersAfterStep } from "../src/workflows/v2/courses/steps/course-outline-steps";

export async function placeBandChaptersWorkflow(
  input: Parameters<typeof placeChaptersAfterStep>[0],
) {
  "use workflow";

  return placeChaptersAfterStep(input);
}
