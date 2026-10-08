import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Whether the learner studied on a day before `today`: time spent, an answer or a lesson that day.
 * Energy rises with study and drops on days away, so it says something only once a day of study
 * has passed: before that, a brand-new learner's buddy has no Energy to show (no empty meter, no
 * nap) and is simply awake, and Statistics says when it starts. One rule for every screen.
 */
export async function hasEnergyStarted({
  today,
  userId,
}: {
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<boolean> {
  const before = await prisma.dailyProgress.findFirst({
    select: { date: true },
    where: {
      OR: [
        { timeSpentSeconds: { gt: 0 } },
        { correctAnswers: { gt: 0 } },
        { incorrectAnswers: { gt: 0 } },
        { lessonsCompleted: { gt: 0 } },
      ],
      date: { lt: today },
      userId,
    },
  });

  return before !== null;
}
