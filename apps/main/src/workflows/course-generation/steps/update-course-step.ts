import { prisma } from "@zoonk/db";

type Input = {
  courseId: number;
  description: string;
  imageUrl: string | null;
  status: string;
};

export async function updateCourseStep(input: Input): Promise<void> {
  "use step";

  await prisma.course.update({
    data: {
      description: input.description,
      generationStatus: input.status,
      imageUrl: input.imageUrl,
    },
    where: { id: input.courseId },
  });
}
