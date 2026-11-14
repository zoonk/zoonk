import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "./errors.ts";
import { shapeOutput } from "./output.ts";

const MODELS = {
  models: [
    { fields: [{ name: "id" }], name: "Goal", relations: ["plan"] },
    { fields: [{ name: "goalId" }], name: "Plan", relations: ["goal"] },
    {
      fields: [{ name: "title" }],
      fixable: [{ fields: ["title"], operation: "set", rules: "Public lessons only." }],
      name: "Lesson",
      relations: [],
    },
  ],
};

describe(shapeOutput, () => {
  it("prints only the fields asked for, from one record or a page of them", () => {
    const goal = { details: { long: "json" }, id: "g1", status: "active" };

    expect(
      shapeOutput({ body: { record: goal }, shape: { fields: ["id", "status"], kind: "fields" } }),
    ).toStrictEqual({ record: { id: "g1", status: "active" } });

    expect(
      shapeOutput({
        body: { hasMore: true, records: [goal, goal] },
        shape: { fields: ["status"], kind: "fields" },
      }),
    ).toStrictEqual({ hasMore: true, records: [{ status: "active" }, { status: "active" }] });
  });

  it("lists model names and the fixable ones, or the named models' fields", () => {
    expect(shapeOutput({ body: MODELS, shape: { kind: "models", names: [] } })).toStrictEqual({
      fixable: ["Lesson"],
      models: ["Goal", "Plan", "Lesson"],
    });

    expect(shapeOutput({ body: MODELS, shape: { kind: "models", names: ["Plan"] } })).toStrictEqual(
      { models: [MODELS.models[1]] },
    );
  });

  it.each([
    [{ record: { id: "g1" } }, { fields: ["title"], kind: "fields" as const }],
    [MODELS, { kind: "models" as const, names: ["Gaol"] }],
  ])("rejects a field or model the answer doesn't have", (body, shape) => {
    expect(() => shapeOutput({ body, shape })).toThrow(
      expect.objectContaining({ exitCode: EXIT_CODES.usage }),
    );
  });
});
