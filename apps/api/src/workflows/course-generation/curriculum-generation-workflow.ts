import { getWorkflowMetadata } from "workflow";
import { generateCurriculumOutline } from "./_internal/generate-curriculum-outline";
import { claimCurriculumGenerationStep } from "./steps/claim-curriculum-generation-step";
import { curriculumStatusStep } from "./steps/curriculum-status-step";
import { finishCurriculumGenerationStep } from "./steps/finish-curriculum-generation-step";
import { installCurriculumStep } from "./steps/install-curriculum-step";
import { startChapterImagesWorkflowStep } from "./steps/start-chapter-images-workflow-step";

/** Explicit authenticated starts replace the whole outline only after every required segment succeeds. */
export async function curriculumGenerationWorkflow(input: {
  courseId: string;
  contentRevision: number;
}): Promise<void> {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  const course = await claimCurriculumGenerationStep({ ...input, workflowRunId });

  if (!course) {
    return;
  }

  const context = { ...input, workflowRunId };

  const outline = await generateCurriculumOutline(course).catch(async (error: unknown) => {
    await finishCurriculumGenerationStep({ context, status: "failed" });
    throw error;
  });

  await curriculumStatusStep({ status: "started", step: "addChapters" });

  const installed = await installCurriculumStep({ chapters: outline, context }).catch(
    async (error: unknown) => {
      await finishCurriculumGenerationStep({ context, status: "failed" });
      throw error;
    },
  );

  if (installed.status === "superseded") {
    return;
  }

  await curriculumStatusStep({ status: "completed", step: "addChapters" });

  await finishCurriculumGenerationStep({
    context: { ...context, contentRevision: installed.contentRevision },
    status: "completed",
  });

  await curriculumStatusStep({
    entityId: course.slug,
    status: "completed",
    step: "completeCourseSetup",
  });

  await startChapterImagesWorkflowStep({ courseId: course.id });
}
