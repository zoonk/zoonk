import { describe, expect, it } from "vitest";
import { type GoalSkillNode } from "../_utils/goal-skill-graph";
import { readWholeCourseWalk } from "./whole-course-walk";

function skill({
  id,
  order,
  prerequisiteIds = [],
}: {
  id: string;
  order: number;
  prerequisiteIds?: string[];
}): GoalSkillNode {
  return {
    areaId: "chapter",
    areaTitle: "Chapter",
    id,
    memberSkillIds: [id],
    order,
    phase: 0,
    prerequisiteIds,
    removed: false,
    sectionTitle: null,
  };
}

describe(readWholeCourseWalk, () => {
  const first = skill({ id: "first", order: 0 });
  const dependent = skill({ id: "dependent", order: 1, prerequisiteIds: [first.id] });
  const other = skill({ id: "other", order: 2 });
  const skills = [first, dependent, other];

  it.each(["dontKnow", "wrong"] as const)(
    "closes a topic after %s and prunes its dependents across parts",
    (outcome) => {
      const walk = readWholeCourseWalk({
        answers: [{ format: "multipleChoice", itemId: "first-1", outcome, skillId: first.id }],
        skills,
      });

      expect(walk.remaining).toStrictEqual([other]);
    },
  );
});
