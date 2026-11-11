import { MS_PER_DAY } from "@zoonk/utils/date";

const REMINDER_TITLE_VARIANTS = 7;
const REMINDER_BODY_VARIANTS = 3;

type ReminderSituation = "exam" | "oneGoal" | "partlyDone" | "severalGoals";

export type ReminderMessage = {
  bodyVariant: number;
  goalId: string;
  goalTitle: string;
  minutesDone: number;
  minutesLeft: number;
  otherGoals: number;
  situation: ReminderSituation;
  titleVariant: number;
};

type OpenGoal = {
  goalId: string;
  isExam: boolean;
  minutesDone: number;
  minutesLeft: number;
  title: string;
};

function getSituation({ goal, otherGoals }: { goal: OpenGoal; otherGoals: number }) {
  if (goal.isExam) {
    return "exam";
  }

  if (goal.minutesDone > 0) {
    return "partlyDone";
  }

  return otherGoals > 0 ? "severalGoals" : "oneGoal";
}

/**
 * Names the first goal with work and counts the rest. Wording rotates by the learner's local day,
 * so a title doesn't repeat within a week.
 */
export function pickReminderMessage({
  goals,
  localDate,
}: {
  goals: readonly [OpenGoal, ...OpenGoal[]];
  localDate: Date;
}): ReminderMessage {
  const [goal, ...rest] = goals;
  const day = Math.round(localDate.getTime() / MS_PER_DAY);

  return {
    bodyVariant: day % REMINDER_BODY_VARIANTS,
    goalId: goal.goalId,
    goalTitle: goal.title,
    minutesDone: goal.minutesDone,
    minutesLeft: goal.minutesLeft,
    otherGoals: rest.length,
    situation: getSituation({ goal, otherGoals: rest.length }),
    titleVariant: day % REMINDER_TITLE_VARIANTS,
  };
}
