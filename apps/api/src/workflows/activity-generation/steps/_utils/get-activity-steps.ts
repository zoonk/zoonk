import { prisma } from "@zoonk/db";
import { z } from "zod";

export type ActivitySteps = { title: string; text: string }[];

const stepContentSchema = z.object({
  text: z.string(),
  title: z.string(),
});

export function parseActivitySteps(steps: { content: unknown }[]): ActivitySteps {
  return steps.map((s) => stepContentSchema.parse(s.content));
}

export async function getActivitySteps(activityId: bigint): Promise<ActivitySteps> {
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true },
    where: { activityId },
  });

  return parseActivitySteps(steps);
}
