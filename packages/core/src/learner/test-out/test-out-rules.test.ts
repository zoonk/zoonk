import { describe, expect, it } from "vitest";
import { pickTestOutSkills, scoreTestOut } from "./test-out-rules";

describe(pickTestOutSkills, () => {
  it("keeps every skill of a small chapter", () => {
    expect(pickTestOutSkills(["a", "b", "c"])).toStrictEqual(["a", "b", "c"]);
  });

  it("spreads questions evenly over a big chapter", () => {
    const skills = Array.from({ length: 16 }, (_, index) => `s${index}`);

    expect(pickTestOutSkills(skills)).toStrictEqual([
      "s0",
      "s2",
      "s4",
      "s6",
      "s8",
      "s10",
      "s12",
      "s14",
    ]);
  });
});

function confirmation(skillId: string) {
  return [
    {
      content: { options: ["a", "b", "c", "d"], select: 1 },
      format: "multipleChoice" as const,
      isCorrect: true,
      itemId: "quick",
      skillId,
    },
    ...[1, 2, 3].map((index) => ({
      content: { steps: ["A", "B", "C", "D"] },
      format: "order" as const,
      isCorrect: true,
      itemId: `order-${index}`,
      skillId,
    })),
  ];
}

describe(scoreTestOut, () => {
  it("confirms only topics with independent quick and low-guess answers", () => {
    const confirmed = confirmation("a");
    const short = confirmation("b").slice(0, 3);

    expect(
      scoreTestOut({ chapterSkillIds: ["a", "b"], results: [...confirmed, ...short] }),
    ).toMatchObject({ knownSkillIds: ["a"], passed: false });

    expect(
      scoreTestOut({ chapterSkillIds: ["a", "b"], results: [...confirmed, ...confirmation("b")] }),
    ).toMatchObject({ knownSkillIds: ["a", "b"], passed: true });
  });

  it("keeps unasked topics in the plan", () => {
    const skills = Array.from({ length: 10 }, (_, index) => `s${index}`);
    const sampled = pickTestOutSkills(skills);

    const score = scoreTestOut({
      chapterSkillIds: skills,
      results: sampled.flatMap((skillId) => confirmation(skillId)),
    });

    expect(score).toMatchObject({ knownSkillIds: sampled, passed: true });
    expect(score.knownSkillIds).not.toContain("s4");
    expect(score.knownSkillIds).not.toContain("s9");
  });
});
