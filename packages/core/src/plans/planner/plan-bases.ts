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
import { DEFAULT_LESSON_MINUTES, type PlannerLesson, assignLessonSkills } from "./plan-units";
import { getSettledSkillIds } from "./settled-skills";
import { keepTeachingOrder } from "./skill-order";
import { countStandInLessons } from "./stand-in-size";
import { listStudiedCores } from "./studied-cores";

const CLOSE_TO_DATE_DAYS = 60;

export type PlanBase = {
  area: string;
  choices: BaseChoice[];
  known: boolean;
  minutes: { deep: number; essential: number; quick: number };
  name: string;
  neededFor: string[];
  skillId: string;
  studied: boolean;
};

const ALL_CHOICES: BaseChoice[] = ["deep", "essential", "quick", "skip"];

function getOpenChoices({
  depth,
  known,
  studied,
}: {
  depth: boolean;
  known: boolean;
  studied: boolean;
}): BaseChoice[] {
  if (known) {
    return [];
  }

  if (studied) {
    return depth ? ["deep"] : [];
  }

  return ALL_CHOICES;
}

type BaseInput = {
  bands?: ReadonlyMap<string, CourseLevel>;
  graph: PlanGraph;
  items: readonly Pick<
    ExistingPlanItem,
    "chapterId" | "completedAt" | "kind" | "lessonId" | "skillId" | "status"
  >[];
  lessons: readonly PlannerLesson[];
  levelFloor?: CourseLevel | null;
  missedSkillIds?: ReadonlySet<string>;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
  settings: Pick<PlanSettings, "skippedAreas">;
  topicLevels: readonly TopicLevel[];
};

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

  const standIn = countStandInLessons({
    lessons: skill.lessons,
    outlined: skill.outlined,
    taught: own.length,
  });

  return [
    ...own.map((lesson) => lesson.minutes),
    ...Array.from({ length: standIn }, () => DEFAULT_LESSON_MINUTES),
  ];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

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
  const studiedCores = listStudiedCores(input);

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
    const core = getCoreLessons(minutes.length);
    const known = settled.has(skill.skillId);
    const done = studiedCores.has(skill.skillId);

    return [
      {
        area: getSkillArea({ graph, skill }),
        choices: getOpenChoices({ depth: minutes.length > core, known, studied: done }),
        known,
        minutes: {
          deep: sum(minutes) * input.paceFactor,
          essential: sum(minutes.slice(0, core)) * input.paceFactor,
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
        studied: done,
      },
    ];
  });
}

export function getBaseChoices({
  bases,
  choices,
}: {
  bases: readonly Pick<PlanBase, "choices" | "known" | "skillId">[];
  choices: readonly StoredBaseChoice[];
}): Map<string, BaseChoice> {
  const stored = new Map(choices.map((entry) => [entry.skillId, entry.choice]));

  return new Map(
    bases
      .filter((base) => !base.known)
      .map((base) => {
        const choice = stored.get(base.skillId);
        return [base.skillId, choice && base.choices.includes(choice) ? choice : "essential"];
      }),
  );
}

export type PlanBases = {
  bases: PlanBase[];
  daysLeft: number | null;
  recommended: Exclude<BaseChoice, "skip">;
};

export function getDefaultBaseChoice(daysLeft: number | null): "essential" | "quick" {
  return daysLeft !== null && daysLeft <= CLOSE_TO_DATE_DAYS ? "quick" : "essential";
}

export function adviseOnBases({
  bases,
  fits,
  targetDate,
  today,
}: {
  bases: PlanBase[];
  fits: () => boolean;
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
