import { type ExistingPlanItem } from "./plan-items";
import { type PlannerLesson } from "./plan-units";

/**
 * The skills a tested-out lesson settles: the one its item counts for, which the test-out found
 * the learner knows (see `markPlanItemsTestedOut`), not the others its chapters tag it with:
 * Rafaela's placement skipped "Voz do autor", and the inference topics of another chapter holding
 * it left her plan. An item whose skill the lesson no longer names (merged since) settles them all.
 */
function getTestedOutSkillIds({
  skillId,
  taught,
}: {
  skillId: string;
  taught: readonly string[] | undefined;
}): readonly string[] {
  return !taught || taught.includes(skillId) ? [skillId] : taught;
}

/**
 * The skills placement or a test-out found the learner knows, by the items they tested out: a
 * lesson is tested out only when the learner knows the skill it counts for (see
 * `getTestedOutSkillIds`), and a stand-in when they know its skill. Lessons the Library outlines
 * for them later stay out of the plan, as the first ones did, so every re-plan keeps what the first
 * build skipped. Undoing the test-out brings its items back to do, and the skills with them, and
 * so does a miss in practice since (`missedSkillIds`): read as settled by the lessons still tested
 * out, the skill's lessons that came back left the plan again (career seed 2049).
 */
export function getSettledSkillIds({
  items,
  lessons,
  missedSkillIds = new Set(),
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "lessonId" | "skillId" | "status">[];
  lessons: readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];
  missedSkillIds?: ReadonlySet<string>;
}): Set<string> {
  const taughtBy = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.skillIds]));

  return new Set(
    items.flatMap((item) => {
      if (item.kind !== "lesson" || !item.skillId || missedSkillIds.has(item.skillId)) {
        return [];
      }

      // A stand-in set aside for time (`skipped`) isn't known: lessons written for it can come in.
      if (!item.lessonId) {
        return item.status === "todo" || item.status === "skipped" ? [] : [item.skillId];
      }

      return item.status === "testedOut"
        ? getTestedOutSkillIds({ skillId: item.skillId, taught: taughtBy.get(item.lessonId) })
        : [];
    }),
  );
}
