import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";

import { streamStatus } from "../stream-status";

type Input = { title: string; locale: string };

/**
 * When a course generation fails, we want to start over.
 * So, we remove the failed course first.
 */
export async function cleanupFailedCourseStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "cleanupFailedCourse" });

  const slug = toSlug(input.title);

  const course = await prisma.course.findFirst({
    select: { id: true },
    where: {
      generationStatus: "failed",
      language: input.locale,
      organization: { slug: AI_ORG_SLUG },
      slug,
    },
  });

  if (course) {
    await prisma.course.delete({
      where: { id: course.id },
    });
  }

  await streamStatus({ status: "completed", step: "cleanupFailedCourse" });
}
