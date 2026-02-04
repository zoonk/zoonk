import { prisma } from "@zoonk/db";
import { z } from "zod";

export type ActivitySteps = { title: string; text: string }[];

const stepContentSchema = z.object({
  text: z.string(),
  title: z.string(),
});

export async function getActivitySteps(activityId: bigint): Promise<ActivitySteps> {
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true },
    where: { activityId },
  });

  return steps.map((step) => {
    const content = stepContentSchema.parse(step.content);
    return { text: content.text, title: content.title };
  });
}
