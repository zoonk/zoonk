import { type BuildPlanInput } from "./build-plan";
import { withBaseChoices } from "./chosen-bases";
import { isStandIn, isUnwrittenLesson } from "./plan-item-rules";
import { buildPlanQueue } from "./plan-queue";
import { type PlannerLesson, type QueueUnit } from "./plan-units";
import { type DroppedUnit } from "./schedule-units";
import { type SkillMinutes, getSkillMinutes } from "./skill-minutes";

const MAX_LINK_ROUNDS = 4;

export type Landing = { asSaved: BuildPlanInput; skillIds: ReadonlySet<string> };

export type LandedUnits = ReadonlyMap<string, readonly QueueUnit[]>;

export function findLanding(input: BuildPlanInput): Landing | null {
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const written = new Set(
    input.heldSkillsLand
      ? []
      : input.items.flatMap((item) => (item.lessonId && item.skillId ? [item.skillId] : [])),
  );

  const { targetDate } = input.goal;

  const isAfterExam = (item: (typeof input.items)[number]) =>
    targetDate !== null && item.scheduledFor !== null && item.scheduledFor > targetDate;

  const standIns = new Set(
    input.items.flatMap((item) =>
      item.status === "todo" &&
      isStandIn(item) &&
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
    isUnwrittenLesson(unit) && landed?.has(unit.skillId ?? "") === true;

  return getSkillMinutes({
    dropped: dropped.filter((unit) => !isHeld(unit)),
    kept,
    pending: [...pending.filter((unit) => !isHeld(unit)), ...[...(landed?.values() ?? [])].flat()],
  });
}

export function withoutWrittenStandIns({
  dropped,
  landed,
}: {
  dropped: readonly DroppedUnit[];
  landed: LandedUnits;
}): DroppedUnit[] {
  const written = new Set(
    [...landed].flatMap(([skillId, units]) =>
      units.every((unit) => unit.lessonId !== null) ? [skillId] : [],
    ),
  );

  return dropped.filter((unit) => !(isUnwrittenLesson(unit) && written.has(unit.skillId ?? "")));
}
