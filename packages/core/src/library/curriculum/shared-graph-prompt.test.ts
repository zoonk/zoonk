import { describe, expect, it } from "vitest";
import { toScopedGraphPrompt } from "./shared-graph-prompt";

function buildInputs(hasMaterial: boolean): Parameters<typeof toScopedGraphPrompt>[0]["inputs"] {
  return {
    examIdentity: null,
    goal: {
      examBlueprintId: null,
      id: "goal-1",
      kind: "learn",
      language: "pt",
      prompt: "Prova de biologia sexta",
      targetLanguage: null,
      title: "Biologia celular",
      userId: "user-1",
    },
    graphPrompt: {
      context: hasMaterial ? "The learner's own material, page by page: …" : undefined,
      goal: "Prova de biologia sexta",
      goalKind: "learn",
      language: "pt",
    },
    hasMaterial,
    sharedContext: undefined,
    startedCourse: null,
  };
}

describe(toScopedGraphPrompt, () => {
  it("tells a private graph built from the learner's material to teach from it", () => {
    const prompt = toScopedGraphPrompt({
      inputs: buildInputs(true),
      scope: { generalGoal: null, ownerId: "user-1" },
    });

    expect(prompt).toMatchObject({ goal: "Prova de biologia sexta", hasMaterial: true });
  });

  it("never gives a shared graph the material rules, since it never reads a learner's material", () => {
    const prompt = toScopedGraphPrompt({
      inputs: buildInputs(false),
      scope: { generalGoal: "Biologia celular", ownerId: null },
    });

    expect(prompt.hasMaterial).toBeUndefined();
    expect(prompt.context).toBeUndefined();
  });
});
