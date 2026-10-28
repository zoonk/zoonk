import { type BuildPlanInput } from "./build-plan";
import { findChapterInProgress } from "./chapter-in-progress";
import { type PlanBase, getBaseChoices } from "./plan-bases";
import {
  type BaseChoice,
  type PlanGraph,
  type PlanGraphSkill,
  type StoredBaseChoice,
} from "./plan-state";
import { type PlannerLesson, assignLessonSkills, getStandInLessons } from "./plan-units";
import { countCoreLessons } from "./studied-cores";

type ChoiceInput = Pick<
  BuildPlanInput,
  "bases" | "graph" | "items" | "lessons" | "missedSkillIds" | "settings"
>;

export function getKeptBaseChoices(
  input: Pick<ChoiceInput, "missedSkillIds" | "settings">,
): StoredBaseChoice[] {
  const missed = input.missedSkillIds ?? new Set<string>();

  return input.settings.baseChoices.filter(
    (entry) => entry.choice !== "skip" || !missed.has(entry.skillId),
  );
}

export function hasBaseChoices(input: ChoiceInput): boolean {
  const chosen = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });
  return [...chosen.values()].some((choice) => choice !== "essential");
}

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
      const core = countCoreLessons({ outlined: own.length, skill });

      const started = own
        .slice(core)
        .filter((lesson) => inProgress !== null && lesson.chapterId === inProgress);

      const size = {
        essential: {
          kept: [...own.slice(0, core), ...started].map((lesson) => lesson.lessonId),
          lessons: core + started.length,
        },
        quick: { kept: [], lessons: skill.outlined && own.length === 0 ? 0 : 1 },
        skip: { kept: [], lessons: 0 },
      }[choice];

      return [[skill.skillId, { kept: new Set(size.kept), lessons: size.lessons }] as const];
    }),
  );
}

function applyBaseChoices({
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
  items?: Parameters<typeof findChapterInProgress>[0];
  lessons: readonly PlannerLesson[];
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

        return size.lessons > 0
          ? [
              {
                ...skill,
                lessons: size.lessons,
                ...(chosen.get(skill.skillId) === "quick" ? { outlined: false } : {}),
              },
            ]
          : [];
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

type BaseInput = Pick<BuildPlanInput, "bases" | "graph" | "lessons" | "quickLessons"> & {
  items: Parameters<typeof findChapterInProgress>[0];
};

export function withBaseChoices<TInput extends BaseInput>({
  choices,
  input,
}: {
  choices: readonly StoredBaseChoice[];
  input: TInput;
}): TInput {
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

export function listQuickBaseIds(input: ChoiceInput): Set<string> {
  const chosen = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });
  return new Set([...chosen].flatMap(([skillId, choice]) => (choice === "quick" ? [skillId] : [])));
}

export function getChosenStandInLessons(input: BuildPlanInput): Map<string, number> {
  const studied = withBaseChoices({ choices: getKeptBaseChoices(input), input });

  return getStandInLessons({ lessons: studied.lessons, skills: studied.graph.skills });
}
