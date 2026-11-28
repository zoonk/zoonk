import { generateWholeSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { describe, expect, it, vi } from "vitest";
import { writeWholeSkillGraph } from "./write-skill-graph";

vi.mock("@zoonk/ai/tasks/curriculum/skill-graph-calls", () => ({
  generateSkillGraphFrame: vi.fn(),
  generateSkillGraphSection: vi.fn(),
  generateWholeSkillGraph: vi.fn(),
}));

function graphWith(levels: ("advanced" | "beginner" | "intermediate")[]) {
  return { data: { skills: levels.map((level) => ({ level })) } } as unknown as Awaited<
    ReturnType<typeof generateWholeSkillGraph>
  >;
}

const params = { goal: "French", goalKind: "language", language: "en" } as const;

describe(writeWholeSkillGraph, () => {
  it("fails a language graph with no situation in a band an aim reaches, so its step retries", async () => {
    vi.mocked(generateWholeSkillGraph).mockResolvedValue(graphWith(["beginner", "intermediate"]));

    await expect(writeWholeSkillGraph(params)).rejects.toThrow("advanced");
  });

  it("keeps a language graph with situations in every band", async () => {
    const graph = graphWith(["beginner", "intermediate", "advanced"]);
    vi.mocked(generateWholeSkillGraph).mockResolvedValue(graph);

    await expect(writeWholeSkillGraph(params)).resolves.toBe(graph);
  });
});
