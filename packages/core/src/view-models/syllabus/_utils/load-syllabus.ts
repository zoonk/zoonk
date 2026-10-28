import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { readExamChoices } from "../../../exams/choices/exam-choices";
import { loadClaimEvents } from "../../../learner/_utils/load-skill-claims";
import {
  type LibrarySource,
  readSkillPrerequisiteMap,
} from "../../../learner/_utils/plan-library-rows";
import { listKnownSkills } from "../../../learner/_utils/skill-claims";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import { listTaughtStandInSkills } from "../../../lookahead/plan-outline-needs";
import { hasPlanDeadline } from "../../../plans/_utils/plan-end";
import {
  type PlanReadContext,
  getPlanReadItemKey,
} from "../../../plans/_utils/plan-read-projection";
import { getWrittenPracticeView } from "../../../plans/_utils/written-practice-view";
import { listFocusedSkillIds } from "../../../plans/planner/focus-targets";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import {
  type PlanGraph,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { loadAreaCourses, loadChapterTitles, withSkills } from "./syllabus-content";
import { type SyllabusInput, type SyllabusSkill } from "./syllabus-input";
import { getPastBasicsSkillIds, withTestedOutSkills } from "./syllabus-known-skills";
import { loadNotice } from "./syllabus-notice";
import { getSkillSubjects } from "./syllabus-subjects";

const itemSelect = {
  chapterId: true,
  id: true,
  kind: true,
  lessonId: true,
  lessons: true,
  phase: true,
  scheduledFor: true,
  skillId: true,
  status: true,
  titleSnapshot: true,
} as const;

function toSkills(graph: PlanGraph): SyllabusSkill[] {
  return graph.skills.map((skill) => ({
    area: getSkillArea({ graph, skill }),
    name: skill.name,
    skillId: skill.skillId,
    topics: skill.topics ?? [],
  }));
}

/** The syllabus's lessons and chapters of a saved plan, in plan order. */
function fromSavedPlan(goal: Partial<Pick<Goal, "primaryCourseId">>, saved: SavedPlan | null) {
  return saved
    ? {
        goal: { primaryCourseId: goal.primaryCourseId ?? null },
        graph: saved.graph,
        items: saved.items.filter((item) => item.kind === "lesson" || item.kind === "chapter"),
        settings: saved.settings,
      }
    : null;
}

/** The plan the syllabus reads: a GET's saved plan, a selection being shown, or a fresh read. */
function readSyllabusPlan(
  goal: Pick<Goal, "id"> & Partial<Pick<Goal, "primaryCourseId">>,
  {
    savedPlan,
    selectedPlan,
  }: { savedPlan?: SavedPlan | null; selectedPlan?: Pick<PlanReadContext, "items" | "state"> },
) {
  if (savedPlan !== undefined) {
    return fromSavedPlan(goal, savedPlan);
  }

  if (selectedPlan) {
    return {
      goal: { primaryCourseId: goal.primaryCourseId ?? null },
      graph: selectedPlan.state.graph,
      items: selectedPlan.items
        .filter((item) => item.kind === "lesson" || item.kind === "chapter")
        .map((item) => ({ ...item, id: item.id ?? getPlanReadItemKey(item) })),
      settings: selectedPlan.state.settings,
    };
  }

  return prisma.plan.findUnique({
    select: {
      goal: { select: { primaryCourseId: true } },
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: itemSelect,
        where: { kind: { in: ["lesson", "chapter"] } },
      },
      settings: true,
    },
    where: { goalId: goal.id },
  });
}

/**
 * Everything a goal's syllabus is built from: the notice (exams), the plan's graph and settings,
 * its lessons in plan order, their chapters' titles and each area's course. Null without a plan.
 * A GET passes the exam's blueprint and the saved plan it already read (see `loadNotice`,
 * `readSavedPlan`).
 */
export async function loadSyllabusInput(
  goal: Pick<
    Goal,
    "createdAt" | "examBlueprintId" | "id" | "kind" | "language" | "targetDate" | "userId"
  > &
    Partial<Pick<Goal, "details" | "primaryCourseId">>,
  {
    blueprint,
    savedPlan,
    selectedPlan,
  }: {
    blueprint?: ExamBlueprint | null | Promise<ExamBlueprint | null>;
    savedPlan?: SavedPlan | null;
    selectedPlan?: Pick<PlanReadContext, "items" | "state">;
  } = {},
): Promise<SyllabusInput | null> {
  const [plan, notice] = await Promise.all([
    readSyllabusPlan(goal, { savedPlan, selectedPlan }),
    loadNotice(goal, blueprint, savedPlan ? readExamChoices(savedPlan.settings) : undefined),
  ]);

  if (!plan) {
    return null;
  }

  const graph = parsePlanGraph(plan.graph);
  const graphSkillIds = new Set(graph.skills.map((skill) => skill.skillId));
  // A GET passes the saved plan it read; its Library rows come from the shared caches.
  const from: LibrarySource = savedPlan === undefined ? prisma : "shared";
  // Already read for the notice above, when a GET passed it.
  const knownBlueprint = blueprint === undefined ? undefined : await blueprint;

  const [items, areaCourses, chapterTitles, claimEvents, prerequisites, taughtSkillIds] =
    await Promise.all([
      withSkills({ from, graphSkillIds, items: plan.items }).then((withOwn) =>
        withTestedOutSkills({ graphSkillIds, items: withOwn }),
      ),
      loadAreaCourses(graph, from),
      loadChapterTitles(plan.items, from),
      loadClaimEvents({
        goalId: goal.id,
        plan: savedPlan,
        skillIds: [...graphSkillIds],
        userId: goal.userId,
      }),
      readSkillPrerequisiteMap([...graphSkillIds], from),
      listTaughtStandInSkills({
        blueprint: knownBlueprint,
        goal: { ...goal, primaryCourseId: plan.goal.primaryCourseId },
        graph,
        items: plan.items,
      }),
    ]);

  const settings = parsePlanSettings(plan.settings);
  const pastBasicsSkillIds = getPastBasicsSkillIds({ graph, items, prerequisites, settings });
  const focused = listFocusedSkillIds({ graph, settings });

  const skippedBaseIds = new Set(
    settings.baseChoices.flatMap((entry) => (entry.choice === "skip" ? [entry.skillId] : [])),
  );

  // A basic the learner passed over by choice is still to confirm, not known: the page says they
  // chose to skip it until practice confirms it.
  const passedOver = (skillId: string) =>
    skippedBaseIds.has(skillId) || pastBasicsSkillIds.has(skillId);

  return {
    areaCourses,
    chapterTitles,
    deadline: hasPlanDeadline({
      studiesPastTarget: goal.kind === "exam" && settings.fullCourse,
      targetDate: goal.targetDate,
    }),
    items,
    knownSkillIds: listKnownSkills({
      events: claimEvents,
      focused: (skillId) => focused.has(skillId),
      passedOver,
    }),
    notice,
    pastBasicsSkillIds,
    skills: toSkills(graph),
    skippedAreas: settings.skippedAreas,
    skippedBaseIds,
    taughtSkillIds,
    writtenPractice: getWrittenPracticeView({
      goal: { createdAt: goal.createdAt, kind: goal.kind, targetDate: goal.targetDate },
      graph,
      settings,
    }),
  };
}

/**
 * Each of the goal's skills by its subject's short name ("Portuguese Language"), for labels on
 * Today's lessons; empty for goals with fewer than two subjects. Reads only the graph, the notice
 * and the areas' courses, so a session doesn't load the whole plan for it. A GET passes the exam's
 * blueprint and the saved plan it already read (see `loadNotice`, `readSavedPlan`).
 */
export async function loadSkillSubjects(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> | null,
  blueprint?: ExamBlueprint | null,
  savedPlan?: Pick<SavedPlan, "graph" | "settings"> | null,
): Promise<Map<string, string>> {
  if (!goal) {
    return new Map();
  }

  const [plan, notice] = await Promise.all([
    savedPlan === undefined
      ? prisma.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } })
      : savedPlan,
    loadNotice(goal, blueprint, savedPlan ? readExamChoices(savedPlan.settings) : undefined),
  ]);

  const graph = parsePlanGraph(plan?.graph);

  if (graph.skills.length === 0) {
    return new Map();
  }

  const areaCourses = await loadAreaCourses(graph, savedPlan === undefined ? prisma : "shared");
  return getSkillSubjects({ areaCourses, notice, skills: toSkills(graph) });
}
