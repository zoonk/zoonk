import { prisma } from "@zoonk/db";

import { streamStatus } from "../stream-status";

type Input = {
  courseId: number;
  description: string;
  imageUrl: string | null;
  status: string;
};

export async function updateCourseStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateCourse" });

  await prisma.course.update({
    data: {
      description: input.description,
      generationStatus: input.status,
      imageUrl: input.imageUrl,
    },
    where: { id: input.courseId },
  });

  await streamStatus({ status: "completed", step: "updateCourse" });
}
