import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { FatalError } from "workflow";

type Input = { title: string; locale: string };
type Output = { id: number; slug: string; organizationId: number };

export async function createCourseStep(input: Input): Promise<Output> {
  "use step";

  const org = await prisma.organization.findUnique({
    select: { id: true },
    where: { slug: AI_ORG_SLUG },
  });

  if (!org) {
    throw new FatalError(`AI organization not found: ${AI_ORG_SLUG}`);
  }

  const slug = toSlug(input.title);
  const normalizedTitle = normalizeString(input.title);

  const course = await prisma.course.create({
    data: {
      generationStatus: "in_progress",
      isPublished: true,
      language: input.locale,
      normalizedTitle,
      organizationId: org.id,
      slug,
      title: input.title,
    },
    select: { id: true, organizationId: true, slug: true },
  });

  return course;
}
