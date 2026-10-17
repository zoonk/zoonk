import { prisma } from "@zoonk/db";

/** Whether the learner studied today, on this goal or another. */
export async function hasStudiedOn({ localDate, userId }: { localDate: Date; userId: string }) {
  const today = await prisma.dailyProgress.findUnique({
    select: { timeSpentSeconds: true },
    where: { userDate: { date: localDate, userId } },
  });

  return (today?.timeSpentSeconds ?? 0) > 0;
}
