import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toListeningExam } from "../../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../../exams/listening/listening-skills";
import {
  type ExamChoiceFormat,
  getExamChoiceFormat,
} from "../../../library/exams/exam-choice-format";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { ensureQuickLessons } from "../../../library/quick-lessons/quick-lessons";
import { loadPlannerInputs } from "../../_utils/planner-inputs";
import { loadGoalPlannerLessons } from "../../_utils/planner-lessons";
import { loadQuickBaseLessons } from "../../_utils/quick-bases";
import { type PlannerLesson } from "../../planner/plan-units";
import { type SimFixtureName } from "./sim-fixture";
import { type SimLibrary, createOwnBlueprint, listTaughtBy, seedSimLibrary } from "./sim-library";

type LoadedInputs = Awaited<ReturnType<typeof loadPlannerInputs>>;

/**
 * What the planner reads from the Library for a fixture's goal, loaded once through the real
 * loaders (`loadPlannerInputs`, `loadQuickBaseLessons`) for a learner with no history: the pure
 * simulator plans from these, with the simulated learner's own state (gaps, readiness) on top.
 */
export type SimInputs = Omit<
  LoadedInputs,
  "answeredWrongSkillIds" | "knownSkillIds" | "missedSkillIds" | "readiness" | "strongAreas"
> & {
  /** How the exam asks its choice questions (`getExamChoiceFormat`); null without an exam. */
  choice: ExamChoiceFormat | null;
  goal: { details: Record<string, unknown>; examBlueprintId: string | null; kind: SimGoalKind };
  library: SimLibrary;
  /** The skills the exam practices only with its recordings (`getListeningSkillIds`). */
  listeningSkillIds: ReadonlySet<string>;
  /**
   * The Library's lessons as the planner loads them while the `pending` skills aren't outlined:
   * their links don't exist yet, so the real loader runs without them (a lesson one of them also
   * teaches keeps its other skills, and takes its place from those).
   */
  loadLessons: (pending: ReadonlySet<string>) => Promise<PlannerLesson[]>;
  /** Each skill's quick lesson, which the Library has once a learner chooses one. */
  quickLessons: Map<string, PlannerLesson>;
  /** The skills each lesson is tied to directly (the fixture's lesson links, by row id). */
  taughtBy: Map<string, string[]>;
};

type SimGoalKind = "exam" | "language" | "learn";

async function loadInputs(name: SimFixtureName): Promise<SimInputs> {
  const library = await seedSimLibrary(name);
  const { fixture } = library;
  const user = await userFixture();

  const examBlueprintId = fixture.blueprint?.owned
    ? await createOwnBlueprint({ library, ownerId: user.id })
    : library.blueprintId;

  const goal = await goalFixture({
    details: fixture.goal.details,
    examBlueprintId,
    kind: fixture.goal.kind,
    language: fixture.goal.language,
    primaryCourseId: library.primaryCourseId,
    targetLanguage: fixture.goal.targetLanguage,
    userId: user.id,
  });

  const skillIds = library.graph.skills.map((skill) => skill.skillId);

  // Quick lessons are outlines the Library creates when a learner chooses one (no model call).
  await ensureQuickLessons({ skillIds });

  const [loaded, quickLessons, examBlueprint] = await Promise.all([
    loadPlannerInputs({
      difficultyBias: "standard",
      goal,
      graph: library.graph,
      targetDate: null,
      userId: user.id,
    }),
    loadQuickBaseLessons({
      baseChoices: skillIds.map((skillId) => ({ choice: "quick" as const, skillId })),
    }),
    examBlueprintId ? prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } }) : null,
  ]);

  const {
    answeredWrongSkillIds: _wrong,
    knownSkillIds: _known,
    missedSkillIds: _missed,
    readiness: _readiness,
    strongAreas: _strong,
    ...shared
  } = loaded;

  const lessonsByPending = new Map<string, Promise<PlannerLesson[]>>();

  const loadLessons = (pending: ReadonlySet<string>) => {
    const key = [...pending].toSorted().join(",");
    const cached = lessonsByPending.get(key);

    if (cached) {
      return cached;
    }

    const skills = library.graph.skills.filter((skill) => !pending.has(skill.skillId));

    const promise =
      pending.size === 0
        ? Promise.resolve(loaded.lessons)
        : loadGoalPlannerLessons({ goal, graph: { ...library.graph, skills }, userId: user.id });

    lessonsByPending.set(key, promise);
    return promise;
  };

  return {
    ...shared,
    choice: examBlueprint
      ? getExamChoiceFormat(readBlueprintContent(examBlueprint).structure)
      : null,
    goal: { details: fixture.goal.details, examBlueprintId, kind: fixture.goal.kind },
    library,
    listeningSkillIds: getListeningSkillIds({
      exam: toListeningExam({ examBlueprint, ...fixture.goal }),
      graph: library.graph,
    }),
    loadLessons,
    quickLessons,
    taughtBy: listTaughtBy(library),
  };
}

const loadedInputs = new Map<SimFixtureName, Promise<SimInputs>>();

/** A fixture's planner inputs, loaded once per test run. */
export function loadSimInputs(name: SimFixtureName): Promise<SimInputs> {
  const existing = loadedInputs.get(name);

  if (existing) {
    return existing;
  }

  const promise = loadInputs(name);
  loadedInputs.set(name, promise);
  return promise;
}
