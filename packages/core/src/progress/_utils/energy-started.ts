import "server-only";
import { type DailyProgress, prisma } from "@zoonk/db";

const ENERGY_ACTIVITY_FIELDS = [
  "timeSpentSeconds",
  "correctAnswers",
  "incorrectAnswers",
  "lessonsCompleted",
] as const;

type EnergyActivityDay = Pick<DailyProgress, "date" | (typeof ENERGY_ACTIVITY_FIELDS)[number]>;

/** The same activity fields serve the bounded query and an already-loaded lifetime ledger. */
function isPriorEnergyDay({ day, today }: { day: EnergyActivityDay; today: Date }): boolean {
  return day.date < today && ENERGY_ACTIVITY_FIELDS.some((field) => day[field] > 0);
}

export function hasEnergyStartedInRows({
  rows,
  today,
}: {
  rows: EnergyActivityDay[];
  today: Date;
}): boolean {
  return rows.some((day) => isPriorEnergyDay({ day, today }));
}

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
      OR: ENERGY_ACTIVITY_FIELDS.map((field) => ({ [field]: { gt: 0 } })),
      date: { lt: today },
      userId,
    },
  });

  return before !== null;
}
