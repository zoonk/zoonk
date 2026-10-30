import { describe, expect, it } from "vitest";
import { type MemoryInsightOutput, toMemoryInsight } from "./memory-insight-rules";

const context = {
  kinds: ["tip", "planChange", "scheduleIdea"] as const,
  skillCount: 2,
  studyTime: "07:00",
};

function output(fields: Partial<MemoryInsightOutput>): MemoryInsightOutput {
  return {
    kind: "tip",
    lessonFocus: null,
    message: "Try a two-minute break before the last questions.",
    skill: null,
    studyTime: null,
    ...fields,
  };
}

describe(toMemoryInsight, () => {
  it("keeps a tip with its trimmed message", () => {
    expect(
      toMemoryInsight({ context, output: output({ message: "  Take a short break.  " }) }),
    ).toStrictEqual({ kind: "tip", message: "Take a short break." });
  });

  it("returns nothing for none, a kind not allowed today, or an empty or overlong message", () => {
    expect(toMemoryInsight({ context, output: output({ kind: "none" }) })).toBeNull();

    expect(
      toMemoryInsight({
        context: { ...context, kinds: ["tip"] },
        output: output({ kind: "scheduleIdea", studyTime: "20:00" }),
      }),
    ).toBeNull();

    expect(toMemoryInsight({ context, output: output({ message: "   " }) })).toBeNull();
    expect(toMemoryInsight({ context, output: output({ message: "a".repeat(241) }) })).toBeNull();
  });

  it("points a plan change at a listed skill, 0-based", () => {
    expect(
      toMemoryInsight({
        context,
        output: output({ kind: "planChange", lessonFocus: " fractions to percentages ", skill: 2 }),
      }),
    ).toStrictEqual({
      kind: "planChange",
      lessonFocus: "fractions to percentages",
      message: "Try a two-minute break before the last questions.",
      skillIndex: 1,
    });
  });

  it("drops a plan change without a listed skill or a focus", () => {
    expect(
      toMemoryInsight({
        context,
        output: output({ kind: "planChange", lessonFocus: "x", skill: 3 }),
      }),
    ).toBeNull();

    expect(
      toMemoryInsight({
        context,
        output: output({ kind: "planChange", lessonFocus: " ", skill: 1 }),
      }),
    ).toBeNull();
  });

  it("keeps a schedule idea only for a real time that differs from the current one", () => {
    expect(
      toMemoryInsight({ context, output: output({ kind: "scheduleIdea", studyTime: "20:00" }) }),
    ).toMatchObject({ kind: "scheduleIdea", studyTime: "20:00" });

    expect(
      toMemoryInsight({ context, output: output({ kind: "scheduleIdea", studyTime: "07:00" }) }),
    ).toBeNull();

    expect(
      toMemoryInsight({ context, output: output({ kind: "scheduleIdea", studyTime: "24:30" }) }),
    ).toBeNull();
  });
});
