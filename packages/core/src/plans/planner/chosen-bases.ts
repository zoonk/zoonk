import { type BuildPlanInput } from "./build-plan";
import { findChapterInProgress } from "./chapter-in-progress";
import { getCoreLessons } from "./core-first";
import { type PlanBase, getBaseChoices } from "./plan-bases";
import { type ExistingPlanItem } from "./plan-items";
import {
  type BaseChoice,
  type PlanGraph,
  type PlanGraphSkill,
  type StoredBaseChoice,
} from "./plan-state";
import { type PlannerLesson, assignLessonSkills, countStandInLessons } from "./plan-units";

type ChoiceInput = Pick<
  BuildPlanInput,
  "bases" | "graph" | "items" | "lessons" | "missedSkillIds" | "settings"
>;

/** How many of a skill's lessons the plan has, outlined and still to write (as `findPlanBases` counts). */
function countSkillLessons({ outlined, skill }: { outlined: number; skill: PlanGraphSkill }) {
  return outlined + countStandInLessons({ lessons: skill.lessons, taught: outlined });
}

/**
 * The skills whose core the learner studied, none of their lessons still to do in the plan: a
 * choice that keeps no more than a base's core changes nothing for them. Kept, a quick lesson for
 * prokaryotes, whose core a class test's learner had studied, planned the plan the way a plan
 * with choices goes, and cell theory left it.
 *
 * @internal The plan rules read a finished base with it (R15); the planner goes through
 * `getKeptBaseChoices`.
 */
export function listStudiedCores(input: {
  graph: Pick<PlanGraph, "skills">;
  items: readonly Pick<ExistingPlanItem, "kind" | "skillId" | "status">[];
  lessons: readonly Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">[];
}): Set<string> {
  const teaching = assignLessonSkills({ lessons: input.lessons, skills: input.graph.skills });
  const outlined = Map.groupBy(teaching.values(), (skillId) => skillId);
  const lessons = input.items.filter((item) => item.kind === "lesson" && item.skillId);
  const todo = new Set(lessons.flatMap((item) => (item.status === "todo" ? [item.skillId] : [])));

  const done = Map.groupBy(
    lessons.filter((item) => item.status === "done"),
    (item) => item.skillId ?? "",
  );

  return new Set(
    input.graph.skills.flatMap((skill) => {
      const outlinedCount = outlined.get(skill.skillId)?.length ?? 0;
      const core = getCoreLessons(countSkillLessons({ outlined: outlinedCount, skill }));
      const studied = (done.get(skill.skillId)?.length ?? 0) >= core;

      return studied && !todo.has(skill.skillId) ? [skill.skillId] : [];
    }),
  );
}

/**
 * The learner's base choices but a skip of a base they then missed a question on: it comes back
 * to its core, as a base without a choice. A choice of no more than a base's core for one whose
 * core they studied changes nothing, so it isn't one (see `listStudiedCores`).
 */
export function getKeptBaseChoices(
  input: Pick<ChoiceInput, "graph" | "items" | "lessons" | "missedSkillIds" | "settings">,
): StoredBaseChoice[] {
  const missed = input.missedSkillIds ?? new Set<string>();
  const studied = listStudiedCores(input);

  return input.settings.baseChoices.filter(
    (entry) =>
      (entry.choice !== "skip" || !missed.has(entry.skillId)) &&
      (entry.choice === "deep" || !studied.has(entry.skillId)),
  );
}

/** Whether the learner chose another way than its core for any of the plan's bases. */
export function hasBaseChoices(input: ChoiceInput): boolean {
  const chosen = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });
  return [...chosen.values()].some((choice) => choice !== "essential");
}

/**
 * Each base's lessons as its choice leaves them: its core (the first third, outlined first, see
 * `getCoreLessons`) with the rest of the chapter the learner is in the middle of (`inProgress`), as
 * a plan short on time keeps it (see `putCoresFirst`), its quick lesson, or none; a base studied in
 * depth keeps them all. Skipping a career's portfolio made the skill whose chapter the learner was
 * in a base, and its core cut that chapter's last lessons and its challenge.
 */
function sizeBases({
  chosen,
  inProgress,
  lessons,
  skills,
}: {
  chosen: ReadonlyMap<string, BaseChoice>;
  inProgress: string | null;
  lessons: readonly PlannerLesson[];
  skills: readonly PlanGraphSkill[];
}): Map<string, { kept: ReadonlySet<string>; lessons: number }> {
  const teaching = assignLessonSkills({ lessons, skills });

  return new Map(
    skills.flatMap((skill) => {
      const choice = chosen.get(skill.skillId);

      if (!choice || choice === "deep") {
        return [];
      }

      const own = lessons.filter((lesson) => teaching.get(lesson.lessonId) === skill.skillId);
      const core = getCoreLessons(countSkillLessons({ outlined: own.length, skill }));

      const started = own
        .slice(core)
        .filter((lesson) => inProgress !== null && lesson.chapterId === inProgress);

      const size = {
        essential: {
          kept: [...own.slice(0, core), ...started].map((lesson) => lesson.lessonId),
          lessons: core + started.length,
        },
        quick: { kept: [], lessons: 1 },
        skip: { kept: [], lessons: 0 },
      }[choice];

      return [[skill.skillId, { kept: new Set(size.kept), lessons: size.lessons }] as const];
    }),
  );
}

/**
 * The planner's graph and lessons with the learner's base choices (see `BaseChoice`): a base keeps
 * its core unless chosen otherwise, every lesson studied in depth, only its quick lesson (from
 * `quickLessons`, or a stand-in of one while it isn't written), or leaves the plan when skipped, so
 * what builds on it no longer waits for it. A choice for a skill that is no longer a base changes
 * nothing. The stored graph never changes: only the planner reads this copy.
 */
export function applyBaseChoices({
  bases,
  choices,
  graph,
  items = [],
  lessons,
  quickLessons = new Map(),
}: {
  bases: readonly PlanBase[];
  choices: readonly StoredBaseChoice[];
  graph: PlanGraph;
  /** The plan's items, which tell the chapter the learner is in the middle of (see `sizeBases`). */
  items?: Parameters<typeof findChapterInProgress>[0];
  lessons: readonly PlannerLesson[];
  /** Each skill's quick lesson the Library has (see `BaseChoice`). */
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
}): { graph: PlanGraph; lessons: PlannerLesson[] } {
  const chosen = getBaseChoices({ bases, choices });

  const sized = sizeBases({
    chosen,
    inProgress: findChapterInProgress(items),
    lessons,
    skills: graph.skills,
  });

  if (sized.size === 0) {
    return { graph, lessons: [...lessons] };
  }

  const quick = [...chosen].flatMap(([skillId, choice]) => {
    const lesson = choice === "quick" ? quickLessons.get(skillId) : undefined;
    return lesson ? [{ ...lesson, skillIds: [skillId] }] : [];
  });

  const keeps = (lessonId: string, skillId: string) => {
    const size = sized.get(skillId);
    return !size || size.kept.has(lessonId);
  };

  return {
    graph: {
      ...graph,
      skills: graph.skills.flatMap((skill) => {
        const size = sized.get(skill.skillId);

        if (!size) {
          return [skill];
        }

        return size.lessons > 0 ? [{ ...skill, lessons: size.lessons }] : [];
      }),
    },
    lessons: [
      ...lessons.map((lesson) => ({
        ...lesson,
        skillIds: lesson.skillIds.filter((skillId) => keeps(lesson.lessonId, skillId)),
      })),
      ...quick,
    ],
  };
}

/** The planner's input with each base studied as `choices` say (see `applyBaseChoices`). */
export function withBaseChoices({
  choices,
  input,
}: {
  choices: readonly StoredBaseChoice[];
  input: BuildPlanInput;
}): BuildPlanInput {
  return {
    ...input,
    ...applyBaseChoices({
      bases: input.bases ?? [],
      choices,
      graph: input.graph,
      items: input.items,
      lessons: input.lessons,
      quickLessons: input.quickLessons,
    }),
  };
}

/** The bases the learner chose to study with a quick lesson instead of their core. */
export function listQuickBaseIds(input: ChoiceInput): Set<string> {
  const chosen = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });
  return new Set([...chosen].flatMap(([skillId, choice]) => (choice === "quick" ? [skillId] : [])));
}
