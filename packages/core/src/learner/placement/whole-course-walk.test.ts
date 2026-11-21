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

  it("skips a missed topic's dependents but still asks an independent topic", () => {
    const walk = readWholeCourseWalk({
      answers: [
        { format: "multipleChoice", itemId: "first-1", outcome: "dontKnow", skillId: first.id },
      ],
      partAnsweredItemIds: new Set(["first-1"]),
      skills,
    });

    expect(walk.ready).toStrictEqual([other]);
  });

  it("defers a single miss until the following part", () => {
    const answers = [
      { format: "multipleChoice", itemId: "first-1", outcome: "wrong", skillId: first.id },
    ] as const;

    expect(
      readWholeCourseWalk({ answers, partAnsweredItemIds: new Set(["first-1"]), skills }).ready,
    ).toStrictEqual([dependent, other]);

    expect(
      readWholeCourseWalk({ answers, partAnsweredItemIds: new Set(), skills }).ready,
    ).toStrictEqual(skills);
  });

  it("stops before a third chapter after two chapters confirm nothing", () => {
    const inOrder = skills.map((topic, index) => ({
      ...topic,
      areaId: `chapter-${index}`,
      prerequisiteIds: [],
    }));

    const answers = inOrder
      .slice(0, 2)
      .map((topic) => ({
        format: "multipleChoice" as const,
        itemId: topic.id,
        outcome: "dontKnow" as const,
        skillId: topic.id,
      }));

    expect(
      readWholeCourseWalk({ answers, partAnsweredItemIds: new Set(), skills: inOrder }).ready,
    ).toStrictEqual([]);
  });
});
