import { prisma } from "@zoonk/db";

import { streamStatus } from "../stream-status";

type Input = { courseId: number; status: string };

export async function updateStatusStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateStatus" });

  await prisma.course.update({
    data: { generationStatus: input.status },
    where: { id: input.courseId },
  });

  await streamStatus({ status: "completed", step: "updateStatus" });
}
