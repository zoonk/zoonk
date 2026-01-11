import { prisma } from "@zoonk/db";

type Input = { courseId: number; status: string };

export async function updateStatusStep(input: Input): Promise<void> {
  "use step";

  await prisma.course.update({
    data: { generationStatus: input.status },
    where: { id: input.courseId },
  });
}
