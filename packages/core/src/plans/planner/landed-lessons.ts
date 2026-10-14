import { type BuildPlanInput } from "./build-plan";
import { withBaseChoices } from "./chosen-bases";
import { isStandInItem } from "./kept-items";
import { buildPlanQueue } from "./plan-queue";
import { type PlannerLesson, type QueueUnit } from "./plan-units";
import { type DroppedUnit } from "./schedule-units";
import { type SkillMinutes, getSkillMinutes } from "./skill-minutes";

/** How many times a landing reads the links lessons gained since (see `findLanding`). */
const MAX_LINK_ROUNDS = 4;

/**
 * An automatic run's landing: the Library wrote lessons since the plan was saved for skills it
 * holds as stand-ins (`skillIds`). The run plans the input as the plan was saved (`asSaved`), each
 * of those skills still a stand-in, and then puts their lessons in their stand-ins' time (see
 * `putLandedLessons`).
 */
export type Landing = { asSaved: BuildPlanInput; skillIds: ReadonlySet<string> };

/** Each landed skill's units in a run's queue: its lessons the plan doesn't hold, then any stand-in left. */
export type LandedUnits = ReadonlyMap<string, readonly QueueUnit[]>;

/**
 * The stand-ins' skills an automatic run plans lessons the plan doesn't hold under (see
 * `getPlannedSkillId`), and the input as the plan was saved: without those lessons, and without
 * the links to those skills a lesson the plan holds under another skill gained since, which would
 * plan it under them. Planned with those lessons, day one's landing put every lesson of an OAB
 * plan's two stand-ins on this week, though their parts ran into December: the week spilled, the
 * rest was laid out again from Monday and 736 items moved. A skill the plan holds lessons of
 * doesn't land: its stand-in is what isn't written yet, and its lessons the plan doesn't hold are
 * the ones its cut left out, which an OAB plan's day-one landing read as written since. It does
 * when the run's only news is its lessons (`heldSkillsLand`): then they're its next chapter. A
 * lesson the plan holds keeps the chapter it holds it in, which a landing's outline can place it
 * in too. A stand-in after the exam doesn't land: no day before it holds its time.
 */
export function findLanding(input: BuildPlanInput): Landing | null {
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const written = new Set(
    input.heldSkillsLand
      ? []
      : input.items.flatMap((item) => (item.lessonId && item.skillId ? [item.skillId] : [])),
  );

  // A stand-in after the exam, in a plan that goes on past it (see `continueAfterExam`), holds no
  // time the plan's days before the exam lay out: its lessons are planned there as any others.
  const { targetDate } = input.goal;

  const isAfterExam = (item: (typeof input.items)[number]) =>
    targetDate !== null && item.scheduledFor !== null && item.scheduledFor > targetDate;

  const standIns = new Set(
    input.items.flatMap((item) =>
      item.status === "todo" &&
      isStandInItem(item) &&
      !written.has(item.skillId ?? "") &&
      !isAfterExam(item)
        ? [item.skillId ?? ""]
        : [],
    ),
  );

  const isNew = (lesson: PlannerLesson) =>
    !planned.has(lesson.lessonId) && lesson.skillIds.some((skillId) => standIns.has(skillId));

  if (
    input.mode !== "automatic" ||
    input.movesPhaseEnds === true ||
    !input.lessons.some((lesson) => isNew(lesson))
  ) {
    return null;
  }

  // The plan with every base's core, which a plan with base choices follows (see `buildPlan`).
  const plannedUnder = (lessons: readonly PlannerLesson[]) =>
    new Map(
      buildPlanQueue(withBaseChoices({ choices: [], input: { ...input, lessons } })).units.flatMap(
        (unit) => (unit.lessonId ? [[unit.lessonId, unit.skillId ?? ""] as const] : []),
      ),
    );

  const skillIds = new Set(
    [...plannedUnder(input.lessons)].flatMap(([lessonId, skillId]) =>
      !planned.has(lessonId) && standIns.has(skillId) ? [skillId] : [],
    ),
  );

  if (skillIds.size === 0) {
    return null;
  }

  const chapters = new Map(
    input.items.flatMap((item) =>
      item.lessonId && item.chapterId ? [[item.lessonId, item.chapterId] as const] : [],
    ),
  );

  // A lesson the plan doesn't hold that teaches another skill too was there before, left out by
  // the cut: it only gained the link to the landed skill.
  const kept = input.lessons.flatMap((lesson) => {
    const chapterId = chapters.get(lesson.lessonId) ?? lesson.chapterId;
    const others = lesson.skillIds.filter((skillId) => !skillIds.has(skillId));

    if (planned.has(lesson.lessonId) || others.length === lesson.skillIds.length) {
      return [{ ...lesson, chapterId }];
    }

    return others.length > 0 ? [{ ...lesson, chapterId, skillIds: others }] : [];
  });

  return {
    asSaved: {
      ...input,
      lessons: withoutGainedLinks({ input, lessons: kept, plannedUnder, standIns }),
    },
    skillIds,
  };
}

/**
 * The lessons without the links to a stand-in's skill that a lesson the plan holds under another
 * gained since: read again until the queue plans every held lesson where the plan holds it.
 */
function withoutGainedLinks({
  input,
  lessons,
  plannedUnder,
  round = 0,
  standIns,
}: {
  input: BuildPlanInput;
  lessons: readonly PlannerLesson[];
  plannedUnder: (lessons: readonly PlannerLesson[]) => ReadonlyMap<string, string>;
  round?: number;
  /** The skills of the plan's stand-ins. */
  standIns: ReadonlySet<string>;
}): PlannerLesson[] {
  const heldUnder = new Map(
    input.items.flatMap((item) => (item.lessonId ? [[item.lessonId, item.skillId]] : [])),
  );

  const now = plannedUnder(lessons);

  const gained = (lesson: PlannerLesson) => {
    const skillId = now.get(lesson.lessonId);
    const held = heldUnder.get(lesson.lessonId);

    return held !== undefined && skillId && skillId !== held && standIns.has(skillId)
      ? skillId
      : null;
  };

  if (round >= MAX_LINK_ROUNDS || !lessons.some((lesson) => gained(lesson))) {
    return [...lessons];
  }

  const unlinked = lessons.flatMap((lesson) => {
    const link = gained(lesson);
    const skillIds = lesson.skillIds.filter((skillId) => skillId !== link);
    return skillIds.length > 0 ? [{ ...lesson, skillIds }] : [];
  });

  return withoutGainedLinks({ input, lessons: unlinked, plannedUnder, round: round + 1, standIns });
}

/**
 * Each landed skill's units in a run's queue (`input`, with what was written since): its lessons
 * the plan doesn't hold, then any stand-in left for what isn't written yet. A skill none of whose
 * lessons that queue plans under it keeps its stand-in.
 */
export function listLandedUnits({
  input,
  landing,
}: {
  input: BuildPlanInput;
  landing: Landing;
}): LandedUnits {
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const own = Map.groupBy(
    buildPlanQueue(input).units.filter(
      (unit) =>
        unit.kind === "lesson" &&
        landing.skillIds.has(unit.skillId ?? "") &&
        !(unit.lessonId && planned.has(unit.lessonId)),
    ),
    (unit) => unit.skillId ?? "",
  );

  return new Map([...own].filter(([, units]) => units.some((unit) => unit.lessonId !== null)));
}

/**
 * A run's skill minutes (see `getSkillMinutes`): a landing's skills count their
 * written lessons (`landed`, the ones left out among `dropped`), not the time their stand-ins
 * held. Counted at the stand-in's estimate, lessons that landed longer than planned read as no
 * time lost, and Today never offered to move the phase dates so they fit by the goal's date.
 */
export function getLandingSkillMinutes({
  dropped,
  kept,
  landed,
  pending,
}: {
  dropped: readonly DroppedUnit[];
  kept: readonly QueueUnit[];
  landed: LandedUnits | null;
  pending: readonly QueueUnit[];
}): SkillMinutes[] {
  const isHeld = (unit: QueueUnit) =>
    unit.kind === "lesson" && unit.lessonId === null && landed?.has(unit.skillId ?? "") === true;

  return getSkillMinutes({
    dropped: dropped.filter((unit) => !isHeld(unit)),
    kept,
    pending: [...pending.filter((unit) => !isHeld(unit)), ...[...(landed?.values() ?? [])].flat()],
  });
}
