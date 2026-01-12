import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";

type Input = { title: string; locale: string };

export async function cleanupFailedCourseStep(input: Input): Promise<void> {
  "use step";

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

  if (!course) {
    return;
  }

  await prisma.course.delete({
    where: { id: course.id },
  });
}
