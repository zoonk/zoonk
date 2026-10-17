import { keepCarriedAfterBases, listBegunSkillIds } from "./carried-bases";
import { findChapterInProgress } from "./chapter-in-progress";
import { takeFocusedToday } from "./focused-today";
import { getSkillArea } from "./graph-areas";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type PlanGraph } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity, scheduleUnits } from "./schedule-units";

/**
 * A new day settles what earlier days left: the lessons the learner was given and didn't finish
 * (`lessonIds`: the last study day's session, which may have drawn lessons due later) and the
 * lessons due before today. Only the day's own settling carries them; a change the learner makes
 * plans from today in the order their change asks for. A change of where to focus keeps today's
 * lessons first, as the learner sees them, but those of the areas it gives less time to
 * (`todayExceptAreas`): Sofia's "more civil law, less philosophy" opened her day with criminal
 * procedure and moved ethics, her heaviest subject, from first to 18th.
 */
export type CarryOver = {
  /**
   * The items the day's settling carried (see `refreshGoalPlan`), which a later run that day
   * carries again, so it lays the plan out as the settling did: planned in the queue's order
   * instead, the first open of Today after it moved lessons a day and left the last ones out.
   */
  itemIds?: readonly string[];
  lessonIds: readonly string[];
  /**
   * The areas a focus gives less time to, whose lessons today plans again, on the change's run and
   * every later one that day, so they lay the plan out as the change did; null keeps none.
   */
  todayExceptAreas?: readonly string[] | null;
};

const LEARN_KINDS = new Set<ExistingPlanItem["kind"]>(["chapter", "lesson"]);

/** A lesson or chapter to study: a stand-in for lessons not outlined yet has nothing to teach. */
function isTeachable(item: ExistingPlanItem): boolean {
  return LEARN_KINDS.has(item.kind) && (item.lessonId !== null || item.chapterId !== null);
}

/**
 * Whether an item is one of today's lessons a focus keeps (see `CarryOver.todayExceptAreas`). The
 * chapter the learner is in the middle of (`inProgress`) keeps today's lessons in an area the change
 * gives less time to as well: it finishes first (R10). "Less essay" took the essay chapter's next
 * lesson out of today's session and put it two days later, behind physics (ENEM 2083).
 */
function isKeptToday({
  carryOver,
  graph,
  inProgress,
  item,
  today,
}: {
  carryOver: CarryOver;
  graph: PlanGraph;
  inProgress: string | null;
  item: ExistingPlanItem;
  today: Date;
}): boolean {
  const except = carryOver.todayExceptAreas;

  if (!except || item.scheduledFor?.getTime() !== today.getTime()) {
    return false;
  }

  if (inProgress !== null && item.chapterId === inProgress) {
    return true;
  }

  const skill = graph.skills.find((entry) => entry.skillId === item.skillId);
  return !skill || !except.includes(getSkillArea({ graph, skill }));
}

/**
 * The phase the learner studies now: the first with work still to do (see `carriesGiven`).
 */
function findCurrentPhase(items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[]) {
  return Math.min(
    ...items.flatMap((item) =>
      item.status === "todo" && (LEARN_KINDS.has(item.kind) || item.kind === "boss")
        ? [item.phase]
        : [],
    ),
  );
}

/**
 * Which lessons a session gave carry over when the learner leaves them: those of the phase they
 * study now or the next. A lesson of a later phase a session gave ahead (a language plan's subject
 * reached it) stays where its phase has it, and a session gives it again while it reaches it:
 * carried first after a missed day, it dated its phase before the one before it, which hadn't
 * begun (R39, language 2010).
 */
export function carriesGiven(
  items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[],
): (item: Pick<ExistingPlanItem, "phase">) => boolean {
  const current = findCurrentPhase(items);
  return (item) => item.phase <= current + 1;
}

/**
 * The keys of the work earlier days left, in the plan's order: what the learner was given and
 * didn't finish (see `carriesGiven`), what was due before today and what the day's settling carried; and with a focus, today's lessons but
 * those of the areas it gives less time to, a stand-in for lessons not written yet included.
 */
function listCarriedKeys({
  carryOver,
  graph,
  items,
  today,
}: {
  carryOver?: CarryOver | null;
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  today: Date;
}): string[] {
  if (!carryOver) {
    return [];
  }

  const given = new Set(carryOver.lessonIds);
  const settled = new Set(carryOver.itemIds);
  const carries = carriesGiven(items);
  const inProgress = findChapterInProgress(items);

  const isGiven = (item: ExistingPlanItem) =>
    item.lessonId !== null && given.has(item.lessonId) && carries(item);

  return items
    .filter(
      (item) =>
        item.status === "todo" &&
        LEARN_KINDS.has(item.kind) &&
        ((isTeachable(item) &&
          ((item.scheduledFor !== null && item.scheduledFor < today) ||
            isGiven(item) ||
            settled.has(item.id))) ||
          isKeptToday({ carryOver, graph, inProgress, item, today })),
    )
    .toSorted((a, b) => a.position - b.position)
    .map((item) => getItemKey(item));
}

/**
 * The keys of today's lessons a change of focus keeps (see `isKeptToday`): they stay today, in
 * their order, even when the day's time no longer holds them all, since the learner saw them.
 */
function listKeptTodayKeys({
  carryOver,
  graph,
  items,
  today,
}: {
  carryOver?: CarryOver | null;
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  today: Date;
}): Set<string> {
  if (!carryOver) {
    return new Set();
  }

  const inProgress = findChapterInProgress(items);

  return new Set(
    items
      .filter(
        (item) =>
          item.status === "todo" &&
          LEARN_KINDS.has(item.kind) &&
          isKeptToday({ carryOver, graph, inProgress, item, today }),
      )
      .map((item) => getItemKey(item)),
  );
}

/**
 * A carried stand-in as its first lesson's part, which keeps it on today's list, and the part the
 * rest of the plan places; a stand-in of one lesson, or a lesson, stays whole.
 */
function splitFirstLesson(unit: QueueUnit): { first: QueueUnit; rest: QueueUnit | null } {
  const lessons = unit.lessons ?? 1;

  if (unit.lessonId !== null || lessons <= 1) {
    return { first: unit, rest: null };
  }

  const perLesson = unit.minutes / lessons;

  return {
    first: { ...unit, lessons: 1, minutes: perLesson },
    rest: { ...unit, lessons: lessons - 1, minutes: unit.minutes - perLesson },
  };
}

/**
 * The units earlier days left, in the order they were planned, and the rest in queue order. A
 * stand-in a focus keeps on today's list carries only its first lesson's part (see
 * `splitFirstLesson`): whole, its lessons took the days after it too.
 */
function splitCarriedUnits({
  keys,
  units,
}: {
  keys: readonly string[];
  units: readonly QueueUnit[];
}): { carried: QueueUnit[]; rest: QueueUnit[] } {
  const order = new Map(keys.map((key, index) => [key, index]));

  const split = units.map((unit) =>
    order.has(unit.key) ? splitFirstLesson(unit) : { first: null, rest: unit },
  );

  return {
    carried: split
      .flatMap(({ first }) => (first ? [first] : []))
      .toSorted((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)),
    rest: split.flatMap(({ rest }) => (rest ? [rest] : [])),
  };
}

/** The days with `minutes` more of each listed day's lesson time set aside (fewer when negative). */
function shiftReserved({
  days,
  minutes,
}: {
  days: readonly PlanDay[];
  minutes: ReadonlyMap<number, number>;
}): PlanDay[] {
  return days.map((day) => {
    const shift = minutes.get(day.date.getTime());

    return shift
      ? { ...day, shape: { ...day.shape, reserved: (day.shape.reserved ?? 0) + shift } }
      : day;
  });
}

/**
 * The kept end a challenge's room goes to: its own, else, once that day has passed, the next phase
 * end the run keeps.
 */
function findRoomEnd({
  ends,
  from,
  phase,
}: {
  ends: ReadonlyMap<number, Date>;
  /** The first day the run plans. */
  from: Date;
  phase: number;
}): Date | undefined {
  const ahead = [...ends].filter(([kept, end]) => kept >= phase && end >= from);
  return ahead.toSorted(([a], [b]) => a - b)[0]?.[1];
}

/**
 * The time each kept phase end's challenge takes on its end day (see `keepPhaseEnds`), by day:
 * carried work fills the day around it, so the challenge stays on the day the learner saw. A
 * challenge a half-studied day left undone, whose end has passed, comes right before the next one
 * (see `keepAfterEarlierChallenges`), so its time is kept on that day too.
 */
function getChallengeRoom({
  ends,
  from,
  units,
}: {
  ends: ReadonlyMap<number, Date>;
  /** The first day the run plans. */
  from: Date;
  units: readonly QueueUnit[];
}): Map<number, number> {
  return units.reduce((room, unit) => {
    const end = unit.kind === "boss" ? findRoomEnd({ ends, from, phase: unit.phase }) : undefined;
    return end ? room.set(end.getTime(), (room.get(end.getTime()) ?? 0) + unit.minutes) : room;
  }, new Map<number, number>());
}

/**
 * The days with the lesson time carried work takes from the first ones, so the rest of the plan
 * fills what's left: the day keeps its size, and what doesn't fit moves on.
 */
export function reserveCarriedTime({
  days,
  minutes,
}: {
  days: readonly PlanDay[];
  minutes: number;
}): PlanDay[] {
  return days.reduce<{ days: PlanDay[]; left: number }>(
    (state, day) => {
      const taken = Math.min(state.left, getLessonCapacity(day));
      const reserved = (day.shape.reserved ?? 0) + taken;

      state.days.push(taken > 0 ? { ...day, shape: { ...day.shape, reserved } } : day);
      return { days: state.days, left: state.left - taken };
    },
    { days: [], left: minutes },
  ).days;
}

/** A unit laid on a plan day, whatever time the day has left. */
function placeOn<TUnit extends QueueUnit>({ day, unit }: { day: PlanDay; unit: TUnit }) {
  return {
    ...unit,
    date: day.date,
    phase: day.shape.phase ?? unit.phase,
    studyMinutes: unit.minutes / (day.shape.share || 1),
  };
}

/**
 * Lays the work earlier days left on the first days, and never leaves any of it out: what the days
 * before the deadline can't hold (the day before a class test is a full review, with no time for
 * lessons) is due with the last of it, where Today offers it to catch up instead of it leaving the
 * plan. Pedro's day before dropped the four lessons Thursday left, two of them his own request.
 * Today's lessons a change of focus keeps (`today`) stay today: laid out by the day's time, the
 * last lesson an OAB learner saw moved to tomorrow when they gave an area less time.
 */
function scheduleCarriedUnits({
  days,
  today,
  units,
}: {
  days: readonly PlanDay[];
  /** The keys of today's lessons a change of focus keeps (see `listKeptTodayKeys`). */
  today: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): ReturnType<typeof scheduleUnits> {
  const schedule = scheduleUnits({ days, units });
  const [first] = days;
  const lastDate = schedule.units.at(-1)?.date.getTime();
  const day = days.find((planDay) => planDay.date.getTime() === lastDate) ?? first;

  if (!day || !first) {
    return schedule;
  }

  const placed = schedule.units.map((unit) =>
    today.has(unit.key) && unit.date > first.date ? placeOn({ day: first, unit }) : unit,
  );

  const kept = schedule.dropped.map(({ fittedMinutes: _fitted, ...unit }) =>
    placeOn({ day: today.has(unit.key) ? first : day, unit }),
  );

  const isToday = (unit: { date: Date }) => unit.date.getTime() === first.date.getTime();
  const all = [...placed, ...kept];

  return {
    ...schedule,
    dropped: [],
    units: [...all.filter((unit) => isToday(unit)), ...all.filter((unit) => !isToday(unit))],
  };
}

/**
 * Lays what earlier days left on the first days, as it was planned (see `scheduleCarriedUnits`),
 * around the challenges of the phase ends the run keeps (see `getChallengeRoom`), and with a change
 * of focus, gives what's left of today to its focused lessons only (see `takeFocusedToday`): the
 * work carried in, the days with its time taken, and the units the rest of the plan places after
 * it. Lessons a session gave ahead of their day filled the day a phase ended on, and its challenge
 * moved a day later though the learner had studied.
 */
export function placeCarriedWork({
  days,
  input,
  phaseEnds,
  units,
  yielded = new Set(),
}: {
  days: readonly PlanDay[];
  input: {
    carryOver?: CarryOver | null;
    graph: PlanGraph;
    items: readonly ExistingPlanItem[];
    prerequisites: ReadonlyMap<string, readonly string[]>;
    today: Date;
  };
  /** The phase end dates the run keeps (see `keepPhaseEnds`). */
  phaseEnds: ReadonlyMap<number, Date>;
  units: readonly QueueUnit[];
  /** The keys of carried work that gives way to the rest (see `scheduleCoresFirst`). */
  yielded?: ReadonlySet<string>;
}) {
  // Today's lessons a change of focus keeps never give way (R4).
  const today = listKeptTodayKeys(input);

  const left = listCarriedKeys(input).filter((key) => today.has(key) || !yielded.has(key));

  const keys = keepCarriedAfterBases({
    begun: listBegunSkillIds({ carried: [], items: input.items }),
    keys: left,
    prerequisites: input.prerequisites,
    today,
    units,
  });

  const { carried, rest } = splitCarriedUnits({ keys, units });

  const first = days[0]?.date;

  const room =
    carried.length > 0 && first
      ? getChallengeRoom({ ends: phaseEnds, from: first, units: rest })
      : new Map();

  const roomed = shiftReserved({ days, minutes: room });
  const schedule = scheduleCarriedUnits({ days: roomed, today, units: carried });

  const reserved = shiftReserved({
    days: reserveCarriedTime({
      days: roomed,
      minutes: carried.reduce((total, unit) => total + unit.minutes, 0),
    }),
    minutes: new Map([...room].map(([time, minutes]) => [time, -minutes])),
  });

  const steered = input.carryOver?.todayExceptAreas
    ? takeFocusedToday({
        begun: listBegunSkillIds({ carried, items: input.items }),
        days: reserved,
        prerequisites: input.prerequisites,
        units: rest,
      })
    : { days: reserved, rest, today: [] };

  return {
    carried: [...carried, ...steered.today],
    days: steered.days,
    /** Carried work that waits for its base among the rest: set aside when it doesn't fit. */
    released: left.filter((key) => !keys.includes(key)),
    rest: steered.rest,
    schedule: { ...schedule, units: [...schedule.units, ...steered.today] },
  };
}
