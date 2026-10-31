import { describe, expect, it, vi } from "vitest";
import { buildSkillGraphSystemPrompt } from "./skill-graph-system-prompt";

// The real instructions: every goal's prompt must mention only the inputs its user prompt sends.
vi.mock("./skill-graph.prompt.md", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("skill-graph.prompt.md", import.meta.url), "utf8") };
});

const KIND_INPUTS = {
  exam: ["`EXAM_BLUEPRINT`", "`SECTION`"],
  language: ["`TARGET_LANGUAGE`"],
  learn: ["`PURPOSE`"],
} as const;

const GOAL_KINDS = ["exam", "language", "learn"] as const;

describe(buildSkillGraphSystemPrompt, () => {
  it.each(GOAL_KINDS)("gives a %s goal its own inputs and none of the other kinds'", (goalKind) => {
    const prompt = buildSkillGraphSystemPrompt({ goalKind });

    const others = GOAL_KINDS.filter((kind) => kind !== goalKind).flatMap(
      (kind) => KIND_INPUTS[kind],
    );

    expect(KIND_INPUTS[goalKind].every((input) => prompt.includes(input))).toBe(true);
    expect(others.filter((input) => prompt.includes(input))).toStrictEqual([]);
    expect(prompt).not.toContain("`LESSON_BUDGET`");
    expect(prompt).not.toContain("**the learner's own material:**");
    expect(prompt).not.toContain("{{");
  });

  it("adds the material and lesson budget rules only to a test from the learner's own material", () => {
    const prompt = buildSkillGraphSystemPrompt({
      goalKind: "exam",
      hasMaterial: true,
      lessonBudget: 15,
    });

    expect(prompt).toContain("**the learner's own material:**");
    expect(prompt).toContain("When `LESSON_BUDGET` is given");
    expect(prompt).toContain("(with `LESSON_BUDGET`, in a skill of its own)");
  });
});
