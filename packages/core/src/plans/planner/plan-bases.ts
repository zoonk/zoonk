import { type CourseLevel } from "@zoonk/db";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { QUICK_LESSON_MINUTES } from "../../library/quick-lessons/quick-lesson-identity";
import { getWorth, isFoundation, weighsTopics } from "./base-worth";
import { getCoreLessons } from "./core-first";
import { getSkillArea } from "./graph-areas";
import { daysBetween } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import {
  type BaseChoice,
  type PlanGraph,
  type PlanGraphSkill,
  type PlanSettings,
  type StoredBaseChoice,
} from "./plan-state";
import {
  DEFAULT_LESSON_MINUTES,
  type PlannerLesson,
  assignLessonSkills,
  countStandInLessons,
} from "./plan-units";
import { getSettledSkillIds } from "./settled-skills";
import { keepTeachingOrder } from "./skill-order";

/**
 * A goal this close (in days) whose time doesn't cover everything in depth gets a quick lesson for
 * each base recommended, so the time goes to what matters most: about two months, the last stretch
 * where breadth on what an exam asks most pays more than building every base.
 */
const CLOSE_TO_DATE_DAYS = 60;

/**
 * A base of the plan (see `findPlanBases`): a skill the goal's topics or final work build on, worth
 * less to the goal than what builds on it, so the learner decides how to study it (see
 * `BaseChoice`). `minutes` is what each choice takes at the learner's pace: every lesson, its core
 * (the first third, at least one), or its quick lesson. `neededFor` are what's built on it and worth
 * more (an exam's notice topics, or a goal's outcome skills), the most valuable first. `known`
 * when placement or a test-out found the learner knows it: it's out of the plan already, with
 * nothing to choose.
 */
export type PlanBase = {
  area: string;
  known: boolean;
  minutes: { deep: number; essential: number; quick: number };
  name: string;
  neededFor: string[];
  skillId: string;
};

type BaseInput = {
  /** The Library band of each skill, which tells a goal that isn't an exam its foundations. */
  bands?: ReadonlyMap<string, CourseLevel>;
  graph: PlanGraph;
  items: readonly Pick<
    ExistingPlanItem,
    "chapterId" | "completedAt" | "kind" | "lessonId" | "skillId" | "status"
  >[];
  lessons: readonly PlannerLesson[];
  /** The band the learner's own level starts at (see `getLevelFloor`). */
  levelFloor?: CourseLevel | null;
  /** The skills the learner missed, which their tested-out lessons don't settle. */
  missedSkillIds?: ReadonlySet<string>;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** Each base's quick lesson the Library has (see `applyBaseChoices`); its estimate otherwise. */
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
  settings: Pick<PlanSettings, "skippedAreas">;
  /** How often the exam asks its notice's topics; empty for goals that don't weigh them. */
  topicLevels: readonly TopicLevel[];
};

/**
 * Each skill's skills built on it, directly or not, in teaching order. A skill the learner knows
 * (`settled`) needs nothing more of what it builds on, so the chain stops there.
 */
function listBuiltOn({
  prerequisites,
  settled,
  skillIds,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  settled: ReadonlySet<string>;
  skillIds: readonly string[];
}): Map<string, string[]> {
  const ids = new Set(skillIds);
  const order = new Map(skillIds.map((skillId, index) => [skillId, index]));

  const dependents = [...prerequisites].reduce((map, [skillId, required]) => {
    required
      .filter((id) => ids.has(id) && ids.has(skillId) && id !== skillId && !settled.has(skillId))
      .forEach((id) => map.set(id, [...(map.get(id) ?? []), skillId]));

    return map;
  }, new Map<string, string[]>());

  const walk = (skillId: string, seen: Set<string>): Set<string> => {
    (dependents.get(skillId) ?? [])
      .filter((id) => !seen.has(id))
      .forEach((id) => {
        seen.add(id);
        walk(id, seen);
      });

    return seen;
  };

  return new Map(
    skillIds.map((skillId) => [
      skillId,
      [...walk(skillId, new Set())].toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    ]),
  );
}

/** The minutes each of a skill's lessons takes, outlined first, then its stand-in's. */
function listLessonMinutes({
  lessons,
  skill,
  teaching,
}: {
  lessons: readonly PlannerLesson[];
  skill: PlanGraphSkill;
  teaching: ReadonlyMap<string, string>;
}): number[] {
  const own = lessons.filter((lesson) => teaching.get(lesson.lessonId) === skill.skillId);
  const standIn = countStandInLessons({ lessons: skill.lessons, taught: own.length });

  return [
    ...own.map((lesson) => lesson.minutes),
    ...Array.from({ length: standIn }, () => DEFAULT_LESSON_MINUTES),
  ];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Skills the learner finished every lesson of: whatever they choose, the plan has nothing more of
 * them. Read from what they finished, never from what the plan has left of them: a base studied
 * for its core has nothing left once its core is done, so read that way the next run planned it
 * whole and the one after it for its core again, and every open of Today moved its last lessons in
 * and out of the plan.
 */
function listFinished({
  input,
  teaching,
}: {
  input: BaseInput;
  teaching: ReadonlyMap<string, string>;
}): Set<string> {
  const done = input.items.reduce(
    (counts, item) =>
      item.kind === "lesson" && item.lessonId && item.skillId && item.status === "done"
        ? counts.set(item.skillId, (counts.get(item.skillId) ?? 0) + 1)
        : counts,
    new Map<string, number>(),
  );

  return new Set(
    input.graph.skills.flatMap((skill) => {
      const finished = done.get(skill.skillId) ?? 0;
      const lessons = listLessonMinutes({ lessons: input.lessons, skill, teaching }).length;

      return finished > 0 && finished >= lessons ? [skill.skillId] : [];
    }),
  );
}

/**
 * The plan's bases (see `PlanBase`), in teaching order: skills of areas the plan keeps that other
 * skills it teaches build on and that are worth less to the goal than the most valuable of them
 * (see `getWorth`): what an exam asks less often than a topic built on it, or what a goal's
 * outcome (its portfolio, its job search) builds on when it's one of the goal's foundations (see
 * `isFoundation`). The topics the exam asks most are never bases, and neither is an outcome skill;
 * a skill beyond the notice that a topic builds on always is, whether or not the notice says how
 * often the exam asks its topics. A goal without outcome skills, and an exam whose skills list
 * none of its notice's topics, has none: its path is its course, and what the learner knows
 * already leaves it through placement and their level.
 */
export function findPlanBases(input: BaseInput): PlanBase[] {
  const { graph } = input;
  const skipped = new Set(input.settings.skippedAreas);
  const settled = getSettledSkillIds(input);
  const asked = getWorth(input);
  const followsNotice = weighsTopics(input);
  const studied = graph.skills.filter((skill) => !skipped.has(getSkillArea({ graph, skill })));

  const finished = listFinished({
    input,
    teaching: assignLessonSkills({ lessons: input.lessons, skills: studied }),
  });

  const kept = studied.filter((skill) => !finished.has(skill.skillId));

  const skillIds = graph.skills.map((skill) => skill.skillId);
  const keptIds = kept.map((skill) => skill.skillId);
  const teaching = assignLessonSkills({ lessons: input.lessons, skills: kept });

  const builtOn = listBuiltOn({
    prerequisites: keepTeachingOrder({ prerequisites: input.prerequisites, skillIds }),
    settled,
    skillIds: keptIds,
  });

  const byId = new Map(graph.skills.map((skill) => [skill.skillId, skill]));

  return kept.flatMap((skill) => {
    const neededBy = (builtOn.get(skill.skillId) ?? [])
      .filter((id) => asked(id) > asked(skill.skillId))
      .toSorted((a, b) => asked(b) - asked(a));

    const foundation =
      followsNotice ||
      isFoundation({
        bands: input.bands ?? new Map(),
        levelFloor: input.levelFloor ?? null,
        neededBy,
        skillId: skill.skillId,
      });

    if (neededBy.length === 0 || skill.outcome || !foundation) {
      return [];
    }

    const minutes = listLessonMinutes({ lessons: input.lessons, skill, teaching });

    return [
      {
        area: getSkillArea({ graph, skill }),
        known: settled.has(skill.skillId),
        minutes: {
          deep: sum(minutes) * input.paceFactor,
          essential: sum(minutes.slice(0, getCoreLessons(minutes.length))) * input.paceFactor,
          quick:
            (input.quickLessons?.get(skill.skillId)?.minutes ?? QUICK_LESSON_MINUTES) *
            input.paceFactor,
        },
        name: skill.name,
        neededFor: [
          ...new Set(
            neededBy.flatMap((id) => {
              const built = byId.get(id);
              return built?.topics?.length ? built.topics : [built?.name ?? ""];
            }),
          ),
        ].filter(Boolean),
        skillId: skill.skillId,
      },
    ];
  });
}

/** The learner's choice for each base still to choose for; a base without one is studied for its core. */
export function getBaseChoices({
  bases,
  choices,
}: {
  bases: readonly PlanBase[];
  choices: readonly StoredBaseChoice[];
}): Map<string, BaseChoice> {
  const open = new Set(bases.filter((base) => !base.known).map((base) => base.skillId));
  const stored = new Map(choices.map((entry) => [entry.skillId, entry.choice]));

  return new Map([...open].map((skillId) => [skillId, stored.get(skillId) ?? "essential"]));
}

/** The plan's bases with what the app recommends for them. */
export type PlanBases = {
  bases: PlanBase[];
  /** Days until the goal's date; null without one. */
  daysLeft: number | null;
  recommended: Exclude<BaseChoice, "skip">;
};

/**
 * What the app recommends for the plan's bases: every lesson when the learner's time covers
 * everything with every base in depth (`fits`); otherwise a quick lesson for each when the date is
 * close (`CLOSE_TO_DATE_DAYS`), so the time goes to what matters most, and their core further away.
 * Never skipping: only a test tells what the learner knows. It reads the plan with every base in
 * depth, so following it never turns it around.
 */
export function adviseOnBases({
  bases,
  fits,
  targetDate,
  today,
}: {
  bases: PlanBase[];
  fits: () => boolean;
  /** The goal's date; null without one. */
  targetDate: Date | null;
  today: Date;
}): PlanBases {
  const daysLeft = targetDate ? daysBetween(today, targetDate) : null;
  const choosable = bases.some((base) => !base.known);

  if (!choosable || fits()) {
    return { bases, daysLeft, recommended: "deep" };
  }

  const close = daysLeft !== null && daysLeft <= CLOSE_TO_DATE_DAYS;

  return { bases, daysLeft, recommended: close ? "quick" : "essential" };
}
