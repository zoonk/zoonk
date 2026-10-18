import { describe, expect, it } from "vitest";
import { type PlannerLesson } from "../planner/plan-units";
import { keepPastBasicsBands } from "./level-bands";

function lesson(lessonId: string, band: PlannerLesson["band"], skillId: string): PlannerLesson {
  return { band, chapterId: null, lessonId, minutes: 4, skillIds: [skillId], title: lessonId };
}

const graph = {
  phases: [{ milestone: null, name: "Basics" }],
  skills: [
    {
      area: "Constitutional",
      lessons: 2,
      name: "Structure",
      phase: 0,
      skillId: "both",
      weight: null,
    },
    {
      area: "Constitutional",
      lessons: 1,
      name: "State",
      phase: 0,
      skillId: "basics",
      weight: null,
    },
    { area: "Civil", lessons: 2, name: "Contracts", phase: 0, skillId: "civil", weight: null },
  ],
};

describe(keepPastBasicsBands, () => {
  it("leaves out an area's easier band where its skill is also taught higher, and nothing else", () => {
    const lessons = [
      lesson("both-basic", "beginner", "both"),
      lesson("both-level", "intermediate", "both"),
      lesson("basics-only", "beginner", "basics"),
      lesson("civil-basic", "beginner", "civil"),
      lesson("civil-level", "intermediate", "civil"),
    ];

    // A skill taught only in the easier band keeps it, and the areas past their basics are the
    // only ones that lose any: a plan never loses a skill's lessons.
    expect(
      keepPastBasicsBands({ graph, lessons, pastBasicsAreas: ["Constitutional"] }).map(
        (kept) => kept.lessonId,
      ),
    ).toStrictEqual(["both-level", "basics-only", "civil-basic", "civil-level"]);
  });
});
