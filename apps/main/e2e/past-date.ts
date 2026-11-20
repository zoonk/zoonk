import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const LEARN_KINDS = ["chapter", "lesson"] as const;
const DATE_DAYS_AGO = -3;

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export async function readTargetDate(goalId: string): Promise<string | null> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

export function countSetAside(goalId: string): Promise<number> {
  return prisma.planItem.count({
    where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "skipped" },
  });
}

/** Moves the goal's date three days back and sets its unstudied lessons aside, as days that passed would. */
export async function passTheDate(goalId: string) {
  const date = isoDaysFromNow(DATE_DAYS_AGO);

  await prisma.$transaction([
    prisma.goal.update({
      data: { targetDate: new Date(`${date}T00:00:00Z`) },
      where: { id: goalId },
    }),
    prisma.planItem.updateMany({
      data: {
        scheduledFor: new Date(`${isoDaysFromNow(DATE_DAYS_AGO - 1)}T00:00:00Z`),
        status: "skipped",
      },
      where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
    }),
    prisma.planItem.deleteMany({
      where: { kind: { notIn: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
    }),
    prisma.studySession.deleteMany({ where: { goalId, status: { in: ["active", "planned"] } } }),
  ]);

  return { date, setAside: await countSetAside(goalId) };
}
