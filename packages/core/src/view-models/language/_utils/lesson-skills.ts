import "server-only";
import { type PlanItem } from "@zoonk/db";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import {
  getChapterSkillRows,
  getLessonSkillRows,
  toIdKey,
} from "../../../library/_utils/shared-rows";
import { type CountedLesson } from "../../../plans/_utils/half-studied";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { getSkippedSkillIds } from "../../../sessions/_utils/review-skills";

/**
 * The plan skills each of the plan's written lessons teaches, its own and its unit's outside a
 * removed area, from shared cached rows. The award reads the planner's lessons instead, so a lesson
 * in two units or one a course filter leaves out can read differently here.
 */
export async function readLessonSkills(
  plan: Pick<SavedPlan, "graph" | "settings"> & {
    items: readonly Pick<PlanItem, "chapterId" | "kind" | "lessonId">[];
  },
): Promise<CountedLesson[]> {
  const graph = parsePlanGraph(plan.graph);
  const removed = getSkippedSkillIds({ graph, settings: plan.settings });

  const kept = new Set(
    graph.skills.flatMap((skill) => (removed.has(skill.skillId) ? [] : skill.skillId)),
  );

  const lessons = plan.items.filter((item) => item.kind === "lesson" && item.lessonId);

  const [lessonRows, chapterRows] = await Promise.all([
    getLessonSkillRows(toIdKey(plan.items.map((item) => item.lessonId))),
    getChapterSkillRows(toIdKey(lessons.map((item) => item.chapterId))),
  ]);

  const own = Map.groupBy(lessonRows, (row) => row.lessonId);
  const unit = Map.groupBy(chapterRows, (row) => row.chapterId);

  return lessons.flatMap((item) => {
    const rows = [
      ...(own.get(item.lessonId ?? "") ?? []),
      ...(unit.get(item.chapterId ?? "") ?? []),
    ];

    const skillIds = [...new Set(rows.map((row) => row.skillId))].filter((id) => kept.has(id));

    return item.lessonId && skillIds.length > 0 ? { lessonId: item.lessonId, skillIds } : [];
  });
}
