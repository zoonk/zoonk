import { describe, expect, it } from "vitest";
import { keepMaterialPrivate } from "./goal-curriculum-steps";

const goal = {
  examBlueprintId: null,
  id: "goal",
  kind: "learn" as const,
  language: "pt",
  prompt: "Biologia celular para a prova de sexta",
  targetLanguage: null,
  title: "Biologia celular",
  userId: "learner",
};

const shared = {
  generalGoal: "Biologia celular",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

describe(keepMaterialPrivate, () => {
  // The scope is decided from the goal as typed while research reads what the learner uploads.
  it("makes a goal's curriculum private when its material linked after the scope was decided", () => {
    expect(
      keepMaterialPrivate({ inputs: { goal, hasMaterial: true }, scope: shared }),
    ).toStrictEqual({
      generalGoal: null,
      language: "pt",
      ownerId: "learner",
      targetLanguage: null,
    });
  });

  it("keeps a shared scope for a goal without material", () => {
    expect(keepMaterialPrivate({ inputs: { goal, hasMaterial: false }, scope: shared })).toBe(
      shared,
    );
  });
});
