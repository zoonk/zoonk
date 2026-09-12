import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";

export async function curriculumStatusStep(input: {
  entityId?: string;
  status: "started" | "completed";
  step: CourseWorkflowStepName;
}): Promise<void> {
  "use step";
  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.status(input);
}
