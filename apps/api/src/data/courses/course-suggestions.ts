import "server-only";
import { type CourseSuggestion, prisma } from "@zoonk/db";

export async function getCourseSuggestionById(
  id: number,
): Promise<Pick<
  CourseSuggestion,
  "description" | "generationRunId" | "generationStatus" | "language" | "slug" | "title"
> | null> {
  return prisma.courseSuggestion.findUnique({
    select: {
      description: true,
      generationRunId: true,
      generationStatus: true,
      language: true,
      slug: true,
      title: true,
    },
    where: { id },
  });
}
