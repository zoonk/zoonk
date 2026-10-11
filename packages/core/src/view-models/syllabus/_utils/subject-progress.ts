import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { type WorkProgress, getWorkProgress } from "../../../plans/_utils/work-progress";
import { type SyllabusItem, type SyllabusSkill } from "./syllabus-input";

function sumWithProgress(items: readonly SyllabusItem[], progress: WorkProgress): number {
  return countLessons(items.filter((item) => getWorkProgress(item.status) === progress));
}

/**
 * A subject's lessons the learner studied, of its size, so its progress moves only with their own
 * work: each skill counts its lessons in the plan whatever their status, never fewer than the graph
 * sizes it, so a plan that cuts its depth for time, sets some aside or brings them back leaves the
 * share as it was (Ana's bars moved when she changed her time and date). The ones they tested out
 * of count apart (`lessonsKnown`): a miss that takes that credit back never lowers what they
 * studied (Sofia's "25 of 255" read 0 after her first mock). A skill the learner knows or passed
 * over, with no lessons in the plan, isn't left to study; lessons without a skill of the subject
 * count as the plan has them.
 */
export function getSubjectProgress({
  items,
  settledSkillIds,
  skills,
}: {
  items: readonly SyllabusItem[];
  /** Skills the learner knows or passed over (a base skipped, basics they're past). */
  settledSkillIds: ReadonlySet<string>;
  skills: readonly SyllabusSkill[];
}): { lessonsDone: number; lessonsKnown: number; lessonsTotal: number } {
  const bySkill = Map.groupBy(items, (item) => item.skillId ?? "");
  const own = new Set(skills.map((skill) => skill.skillId));

  const sized = skills.reduce((total, skill) => {
    const planned = countLessons(bySkill.get(skill.skillId) ?? []);
    const settled = planned === 0 && settledSkillIds.has(skill.skillId);
    return settled ? total : total + Math.max(skill.lessons ?? 0, planned);
  }, 0);

  const unsized = items.filter((item) => !item.skillId || !own.has(item.skillId));

  return {
    lessonsDone: sumWithProgress(items, "studied"),
    lessonsKnown: sumWithProgress(items, "testedOut"),
    lessonsTotal: sized + countLessons(unsized),
  };
}
