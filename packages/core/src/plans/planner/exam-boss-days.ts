import { getBossSkillIds, isBossTeachingItem } from "../../checkpoints/checkpoint-rules";
import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { type BossCandidate, listBossCandidates, projectBossPlan } from "./boss-projection";
import { type BuildPlanInput } from "./build-plan";
import { getExamChallengeDayRules, listPhaseChallengeDays } from "./phase-challenge-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem, getItemKey } from "./plan-items";
import { type PlanPhase } from "./plan-state";
import { type FixedEvent, type PlanDay } from "./schedule-units";

export type ExamBossDays = ReadonlyMap<
  string,
  { beside: boolean; date: string; tested?: readonly string[] }
>;

function getLastTeachingDay({
  before,
  days,
}: {
  before: string;
  days: ReadonlyMap<string, number> | undefined;
}): Date | undefined {
  const last = [...(days?.keys() ?? [])]
    .filter((day) => day < before)
    .toSorted()
    .at(-1);

  return last ? fromIsoDate(last) : undefined;
}

function getChallengeDays({
  days,
  exam,
}: {
  days: readonly string[];
  exam: string | null;
}): readonly string[] {
  const before = days.filter((day) => exam !== null && day < exam);
  return before.length > 0 ? before : days;
}

export function placeExamBosses({
  built,
  input,
  rows,
  survivors,
}: {
  built: {
    items: readonly PlannedItem[];
    keptKeys: ReadonlySet<string>;
    lessonRawMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
    phases: readonly PlanPhase[];
    skillLessons: ReadonlyMap<string, number>;
    studyDays: readonly string[];
    teachingEnds: ReadonlyMap<string, Date>;
  };
  input: Pick<BuildPlanInput, "goal" | "graph" | "items" | "settings">;
  rows?: ItemSkillRows;
  survivors?: ReadonlyMap<string, string>;
}): ExamBossDays {
  const candidates = listBossCandidates({ built });
  const exam = input.goal.targetDate && toIsoDate(input.goal.targetDate);

  const movedOnto = new Set(input.settings.movedEvents.map((move) => move.to));

  const savedDays = new Map(
    input.items.flatMap((item) =>
      item.kind === "boss" && item.scheduledFor
        ? [[getItemKey(item), toIsoDate(item.scheduledFor)] as const]
        : [],
    ),
  );

  const canGoOn = (key: string, day: string) => !movedOnto.has(day) || savedDays.get(key) === day;

  const listStudyDays = (key: string) =>
    getChallengeDays({ days: built.studyDays.filter((day) => canGoOn(key, day)), exam });

  const { at, plan, without } = projectBossPlan({ built, candidates, input, rows, survivors });

  const learn = plan.items.filter((item) => isBossTeachingItem(item) && item.scheduledFor);

  const endOf = (item: PlannedItem, studyDays: readonly string[]) =>
    (exam && studyDays[0] && studyDays[0] < exam
      ? getLastTeachingDay({ before: exam, days: built.lessonRawMinutes.get(item.key) })
      : undefined) ??
    built.teachingEnds.get(item.key) ??
    item.scheduledFor;

  const listAsked = ({ afterDay, day, key, phase }: Spot) => {
    const position = at({ beside: afterDay, day, key, phase });

    return new Set(
      getBossSkillIds({ ...without(key), boss: { phase, position, scheduledFor: day } }),
    );
  };

  const asks = (item: (typeof learn)[number], asked: ReadonlySet<string>) =>
    (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => asked.has(skillId));

  const listTested = (spot: Spot) => {
    const asked = listAsked(spot);
    const position = at({ beside: spot.afterDay, day: spot.day, key: spot.key, phase: spot.phase });

    return learn.filter((item) => item.position < position && asks(item, asked));
  };

  const keepOwn = (tested: readonly (typeof learn)[number][], phase: number) => {
    const own = tested.filter((item) => item.phase === phase);
    return (own.length > 0 ? own : tested).map((item) => item.key);
  };

  const listOn = ({ date, key, phase }: { date: string; key: string; phase: number }) => {
    const day = fromIsoDate(date);
    const leading = listTested({ afterDay: false, day, key, phase });
    return leading.length > 0 ? leading : listTested({ afterDay: true, day, key, phase });
  };

  const lastEnd = (items: readonly PlannedItem[], studyDays: readonly string[]) =>
    items.reduce<string | null>((latest, item) => {
      const end = endOf(item, studyDays);
      const day = end ? toIsoDate(end) : null;
      return day && (!latest || day > latest) ? day : latest;
    }, null);

  const shown = new Set(plan.skills.map((skill) => skill.id));

  const listOwnTeaching = (phase: number) =>
    learn.filter(
      (item) =>
        item.phase === phase &&
        (plan.itemSkillIds.get(item.id) ?? []).some((skillId) => shown.has(skillId)),
    );

  const placeOne = (candidate: BossCandidate) => {
    const { phase } = candidate;
    const own = listOwnTeaching(phase);
    const studyDays = listStudyDays(candidate.key);
    const lastTaught = lastEnd(own, studyDays);

    if (!lastTaught) {
      return placeAfterWindow(candidate);
    }

    const day = findStudyDayAfter(studyDays, lastTaught);

    return {
      beside: day === undefined,
      date: day ?? lastTaught,
      tested: own.map((item) => item.key),
    };
  };

  const placeAfterWindow = (candidate: BossCandidate) => {
    const { key, phase } = candidate;
    const anchor = candidate.date;
    const studyDays = listStudyDays(key);
    const atAnchor = lastEnd(listOn({ date: anchor, key, phase }), studyDays);

    const ends = learn
      .map((item) => endOf(item, studyDays))
      .filter((end): end is Date => end !== undefined && end !== null);

    const changeDays = [
      ...new Set(
        ends.flatMap((end) => {
          const day = findStudyDayAfter(studyDays, toIsoDate(end));
          return day ? [day] : [];
        }),
      ),
    ].toSorted();

    const date: string | undefined = atAnchor
      ? findStudyDayAfter(studyDays, atAnchor)
      : (changeDays.find((day) => day > anchor) ?? anchor);

    if (!date) {
      return { beside: true, date: atAnchor ?? anchor, tested: [] as string[] };
    }

    for (let day: string | undefined = date; day;) {
      const on: string = day;
      const tested = listOn({ date: on, key, phase });
      const end = lastEnd(tested, studyDays);
      const keys = tested.map((item) => item.key);

      if (tested.length > 0 && end !== null && end < on) {
        return { beside: false, date: on, tested: keys };
      }

      day =
        end === null
          ? changeDays.find((event) => event > on)
          : findStudyDayAfter(studyDays, end > on ? end : on);

      if (!day && end !== null) {
        return { beside: true, date: end, tested: keys };
      }
    }

    return {
      beside: false,
      date: anchor,
      tested: listOn({ date: anchor, key, phase }).map((item) => item.key),
    };
  };

  const keptBosses = plan.items.flatMap((boss) => {
    if (boss.kind !== "boss" || boss.status !== "todo" || !built.keptKeys.has(boss.key)) {
      return [];
    }

    const asked = new Set(getBossSkillIds({ ...plan, boss }));
    const tested = learn.filter((item) => item.position < boss.position && asks(item, asked));
    const date = boss.scheduledFor ? toIsoDate(boss.scheduledFor) : "";
    return [[boss.key, { beside: false, date, tested: keepOwn(tested, boss.phase) }] as const];
  });

  return new Map([
    ...keptBosses,
    ...candidates.map((candidate) => [candidate.key, placeOne(candidate)] as const),
  ]);
}

function findStudyDayAfter(days: readonly string[], date: string): string | undefined {
  let low = 0;
  let high = days.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if ((days[middle] ?? "") <= date) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return days[low];
}

type Spot = { afterDay: boolean; day: Date; key: string; phase: number };

export function listBossEvents({
  bossDays,
  bossMinutes,
  date,
}: {
  bossDays: ExamBossDays;
  bossMinutes: (phase: number) => number;
  date: Date;
}): FixedEvent[] {
  const day = toIsoDate(date);

  return [...bossDays].flatMap(([key, placed]) => {
    const phase = Number(key.slice(key.indexOf(":") + 1));

    return placed.date === day
      ? [
          {
            key,
            kind: "boss" as const,
            minutes: bossMinutes(phase),
            replacesDay: false,
            title: "",
            ...(placed.beside ? { beside: true } : { leads: true }),
            ownPhase: phase,
          },
        ]
      : [];
  });
}

export function withBossEvents({
  bosses,
  events,
}: {
  bosses: readonly FixedEvent[];
  events: readonly FixedEvent[];
}): FixedEvent[] {
  const taken = bosses.reduce((total, boss) => total + (boss.beside ? 0 : boss.minutes), 0);

  const kept =
    taken > 0
      ? events.map((event) =>
          event.kind === "review"
            ? { ...event, minutes: Math.max(0, event.minutes - taken) }
            : event,
        )
      : events;

  return [...kept, ...bosses];
}

export function listBossDayFacts({
  days,
  input,
  kept,
  units,
}: {
  days: readonly PlanDay[];
  input: Pick<BuildPlanInput, "goal" | "settings">;
  kept: ReadonlyMap<string, readonly { date: string }[]>;
  units: readonly { key: string; teachingEnd?: Date }[];
}): { studyDays: string[]; teachingEnds: Map<string, Date> } {
  const teachingEnds = new Map(
    units.flatMap((unit) => (unit.teachingEnd ? [[unit.key, unit.teachingEnd] as const] : [])),
  );

  for (const [key, portions] of kept) {
    const last = portions
      .map((portion) => portion.date)
      .toSorted()
      .at(-1);

    const end = last && fromIsoDate(last);
    const laid = teachingEnds.get(key);

    if (end && (!laid || end > laid)) {
      teachingEnds.set(key, end);
    }
  }

  const rules = getExamChallengeDayRules({
    settings: input.settings,
    targetDate: input.goal.targetDate,
  });

  return { studyDays: listPhaseChallengeDays({ days, rules }), teachingEnds };
}
