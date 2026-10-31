import { MS_PER_DAY } from "@zoonk/utils/date";

const DAYS_PER_WEEK = 7;
const SECONDS_PER_MINUTE = 60;

const MIN_TURNAROUND_GAIN = 0.2;

export type RecapDay = { correct: number; date: Date; incorrect: number; seconds: number };

export type WeekNumbers = {
  /** Minutes per studied day, excluding days without study. */
  averageMinutes: number;
  daysStudied: Date[];
  minutes: number;
  questions: number;
};

export function summarizeWeek({
  days,
  weekStart,
}: {
  days: readonly RecapDay[];
  weekStart: Date;
}): WeekNumbers {
  const end = weekStart.getTime() + DAYS_PER_WEEK * MS_PER_DAY;

  const inWeek = days.filter(
    (day) => day.date.getTime() >= weekStart.getTime() && day.date.getTime() < end,
  );

  const studied = inWeek.filter((day) => day.seconds > 0);

  const minutes = Math.round(
    inWeek.reduce((sum, day) => sum + day.seconds, 0) / SECONDS_PER_MINUTE,
  );

  return {
    averageMinutes: studied.length > 0 ? Math.round(minutes / studied.length) : 0,
    daysStudied: studied.map((day) => day.date).toSorted((a, b) => a.getTime() - b.getTime()),
    minutes,
    questions: inWeek.reduce((sum, day) => sum + day.correct + day.incorrect, 0),
  };
}

export function compareWeeks({
  current,
  previous,
}: {
  current: WeekNumbers;
  previous: WeekNumbers;
}) {
  return {
    days: current.daysStudied.length - previous.daysStudied.length,
    minutes: current.minutes - previous.minutes,
    questions: current.questions - previous.questions,
  };
}

export type SkillAnswer = {
  answeredAt: Date;
  isCorrect: boolean;
  localDate: Date;
  skillId: string;
};

export type Turnaround = {
  from: number;
  /** Accuracy fractions; null for days without answers. */
  points: { accuracy: number | null; date: Date }[];
  /** Distinct later days whose first answer was correct. */
  rememberedOn: Date[];
  skillId: string;
  to: number;
};

function getSkillTurnaround({
  answers,
  skillId,
  weekStart,
}: {
  answers: readonly SkillAnswer[];
  skillId: string;
  weekStart: Date;
}): Turnaround | null {
  const own = answers.filter((answer) => answer.skillId === skillId);

  const points = Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * MS_PER_DAY);
    const day = own.filter((answer) => answer.localDate.getTime() === date.getTime());

    const accuracy =
      day.length > 0 ? day.filter((answer) => answer.isCorrect).length / day.length : null;

    return {
      accuracy,
      date,
      first: day.toSorted((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())[0],
    };
  });

  const studied = points.filter((point) => point.accuracy !== null);
  const first = studied[0];
  const last = studied.at(-1);

  if (!first || !last || studied.length < 2) {
    return null;
  }

  return {
    from: first.accuracy ?? 0,
    points: points.map(({ accuracy, date }) => ({ accuracy, date })),
    rememberedOn: studied
      .slice(1)
      .filter((point) => point.first?.isCorrect)
      .map((point) => point.date),
    skillId,
    to: last.accuracy ?? 0,
  };
}

export function findBiggestTurnaround({
  answers,
  weekStart,
}: {
  answers: readonly SkillAnswer[];
  weekStart: Date;
}): Turnaround | null {
  const skillIds = [...new Set(answers.map((answer) => answer.skillId))];

  return (
    skillIds
      .flatMap((skillId) => {
        const turnaround = getSkillTurnaround({ answers, skillId, weekStart });

        return turnaround && turnaround.to - turnaround.from >= MIN_TURNAROUND_GAIN
          ? [turnaround]
          : [];
      })
      .toSorted((a, b) => b.to - b.from - (a.to - a.from))[0] ?? null
  );
}
