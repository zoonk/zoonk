import { describe, expect, it } from "vitest";
import {
  countGapLessons,
  findSkillChapterId,
  isChapterSized,
  orderPrerequisiteChain,
} from "./gap-size";

function edge(skillId: string, prerequisiteId: string) {
  return { prerequisiteId, skillId };
}

describe(orderPrerequisiteChain, () => {
  it("puts everything a skill rests on before it, the root last", () => {
    // percent rests on fractions and decimals; decimals rest on fractions too.
    const edges = [
      edge("percent", "fractions"),
      edge("percent", "decimals"),
      edge("decimals", "fractions"),
      edge("fractions", "division"),
    ];

    expect(orderPrerequisiteChain({ edges, rootId: "percent" })).toStrictEqual([
      "division",
      "fractions",
      "decimals",
      "percent",
    ]);
  });

  it("is only the root when nothing unlearned is behind it", () => {
    expect(
      orderPrerequisiteChain({ edges: [edge("other", "x")], rootId: "percent" }),
    ).toStrictEqual(["percent"]);
  });

  it("skips a cycle instead of following it", () => {
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(orderPrerequisiteChain({ edges, rootId: "a" })).toStrictEqual(["c", "b", "a"]);
  });

  it("keeps the skills nearest the root when the chain is long", () => {
    const names = Array.from({ length: 12 }, (_, index) => `s${index}`);
    const edges = names.slice(1).map((name, index) => edge(names[index] ?? "", name));

    const chain = orderPrerequisiteChain({ edges, rootId: "s0" });

    expect(chain).toStrictEqual(["s7", "s6", "s5", "s4", "s3", "s2", "s1", "s0"]);
  });
});

describe(countGapLessons, () => {
  const lessons = [
    { chapterId: "fractions-chapter", lessonId: "l1", skillIds: ["fractions"] },
    { chapterId: "fractions-chapter", lessonId: "l2", skillIds: ["fractions", "decimals"] },
    { chapterId: "planned-chapter", lessonId: "l3", skillIds: ["decimals"] },
  ];

  it("counts each new lesson once and a skill without lessons as one placeholder", () => {
    const count = countGapLessons({
      lessons,
      plannedLessonIds: new Set(["l3"]),
      skillIds: ["fractions", "decimals", "percent"],
    });

    expect(count.lessons).toBe(3);

    expect(count.perSkill).toStrictEqual(
      new Map([
        ["fractions", 2],
        ["decimals", 2],
        ["percent", 1],
      ]),
    );
  });

  it("adds nothing for a skill whose lessons the plan already has", () => {
    const count = countGapLessons({
      lessons,
      plannedLessonIds: new Set(["l2", "l3"]),
      skillIds: ["decimals"],
    });

    expect(count.lessons).toBe(0);
  });
});

describe(isChapterSized, () => {
  it("treats up to four lessons as a few and more as a chapter's worth", () => {
    expect([1, 4, 5].map((lessons) => isChapterSized(lessons))).toStrictEqual([false, false, true]);
  });
});

describe(findSkillChapterId, () => {
  it("is the chapter of the skill's first lesson, or null without one", () => {
    const lessons = [
      { chapterId: null, lessonId: "l0", skillIds: ["fractions"] },
      { chapterId: "fractions-chapter", lessonId: "l1", skillIds: ["fractions"] },
      { chapterId: "other-chapter", lessonId: "l2", skillIds: ["fractions"] },
    ];

    expect(findSkillChapterId({ lessons, skillId: "fractions" })).toBe("fractions-chapter");
    expect(findSkillChapterId({ lessons, skillId: "percent" })).toBeNull();
  });
});
