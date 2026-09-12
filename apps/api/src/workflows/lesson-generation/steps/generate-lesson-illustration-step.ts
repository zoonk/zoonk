import { getLessonRevisionContext } from "@/workflows/_shared/course-generation-context";
import { getLessonCacheTag } from "@zoonk/core/cache-tags";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { prisma } from "@zoonk/db";
import { revalidateTag } from "next/cache";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonContext } from "./get-lesson-step";

/** Saved artwork is reused on retry; the explicit position cannot shift onto another step. */
export async function generateLessonIllustrationStep({
  alt,
  context,
  prompt,
  stepIndex,
}: {
  alt?: string;
  context: LessonContext;
  prompt: string;
  stepIndex: number;
}): Promise<void> {
  "use step";

  const step = await prisma.step.findFirst({
    where: { kind: "static", lessonId: context.id, position: stepIndex },
  });

  if (!step) {
    return;
  }

  const content = parseStepContent("static", step.content);

  if (content.variant !== "text" || content.image) {
    return;
  }

  const current = await withCurrentCourseRevision({
    context: getLessonRevisionContext(context),
    operation: async () => true,
  });

  if (current.status === "superseded") {
    return;
  }

  const [image] = await generateStepImages({
    language: context.language,
    orgSlug: context.chapter.course.organization?.slug,
    prompts: [prompt],
  });

  if (!image) {
    throw new Error("Lesson illustration returned no image");
  }

  const saved = await withCurrentCourseRevision({
    context: getLessonRevisionContext(context),
    operation: async (transaction) => {
      const latest = await transaction.step.findUnique({ where: { id: step.id } });

      if (!latest) {
        return;
      }

      const latestContent = parseStepContent("static", latest.content);

      if (latestContent.variant !== "text" || latestContent.image) {
        return;
      }

      await transaction.step.update({
        data: { content: { ...latestContent, image: { ...image, ...(alt ? { alt } : {}) } } },
        where: { id: latest.id },
      });
    },
  });

  if (saved.status === "applied") {
    revalidateTag(getLessonCacheTag(context.id), { expire: 0 });
  }
}
