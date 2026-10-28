import "server-only";
import { type Goal, type GoalKind } from "@zoonk/db";
import { loadBossBankFacts } from "../../checkpoints/_utils/load-boss-bank-facts";
import { loadListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import { loadItemSkillRows } from "../../learner/_utils/plan-library-rows";
import { loadSkillSurvivorMap } from "../../learner/_utils/update-learner-skill";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { type BossPlanFacts } from "../planner/planned-bosses";

/**
 * What a planning run's bosses ask (see `BossPlanFacts`), read before it plans: the skills the
 * Library says every lesson and chapter the run can place teaches, their survivors, and the question
 * bank on them as the learner (`userId`; null for a public estimate, which reads no answers) meets
 * it. A language goal's bosses are live calls: no bank to read.
 */
export async function loadBossPlanFacts({
  chapterIds,
  examBlueprintId,
  goalKind,
  graph,
  lessonIds,
  listeningSkillIds,
  userId,
}: {
  chapterIds: readonly string[];
  examBlueprintId: string | null;
  goalKind: GoalKind;
  graph: PlanGraph;
  lessonIds: readonly string[];
  listeningSkillIds: ReadonlySet<string>;
  userId: string | null;
}): Promise<BossPlanFacts> {
  const rows = await loadItemSkillRows({
    chapterIds: [...new Set(chapterIds)].toSorted(),
    lessonIds: [...new Set(lessonIds)].toSorted(),
  });

  const taught = [
    ...graph.skills.map((skill) => skill.skillId),
    ...rows.lessonSkills.map((row) => row.skillId),
    ...rows.chapterLessons.flatMap((row) => row.lesson.skills.map((skill) => skill.skillId)),
  ];

  const survivors = await loadSkillSurvivorMap([...new Set(taught)]);
  const skillIds = [...new Set(taught.map((skillId) => survivors.get(skillId) ?? skillId))];

  const bank =
    goalKind === "language"
      ? { recordingSets: [], textCounts: new Map<string, number>() }
      : await loadBossBankFacts({ examBlueprintId, listeningSkillIds, skillIds, userId });

  return {
    bank,
    listeningSkillIds,
    rows,
    survivors: new Map([...survivors].toSorted(([a], [b]) => a.localeCompare(b))),
  };
}

/**
 * What a planning run's bosses ask (see `loadBossPlanFacts`): from the lessons the run can place
 * and the plan's kept items, which the session reads (a done lesson the graph no longer has), with
 * the listening skills of the graph this run plans, not the one the plan saved before it.
 */
export async function loadRunBossFacts({
  context: { goal, items },
  graph,
  lessons,
  quick,
}: {
  context: {
    goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "userId">;
    items: readonly Pick<ExistingPlanItem, "chapterId" | "lessonId">[];
  };
  graph: PlanGraph;
  lessons: readonly PlannerLesson[];
  quick: ReadonlyMap<string, PlannerLesson>;
}): Promise<BossPlanFacts> {
  const placeable = [...lessons, ...quick.values(), ...items];
  const exam = await loadListeningExam(goal.id);

  return loadBossPlanFacts({
    chapterIds: placeable.flatMap((item) => item.chapterId ?? []),
    examBlueprintId: goal.examBlueprintId,
    goalKind: goal.kind,
    graph,
    lessonIds: placeable.flatMap((item) => item.lessonId ?? []),
    listeningSkillIds: getListeningSkillIds({ exam, graph }),
    userId: goal.userId,
  });
}
