import { randomUUID } from "node:crypto";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadExamChoiceViews } from "../../exams/choices/load-exam-choices";
import { loadTargetCutoff } from "../../exams/cutoffs/load-target-cutoff";
import { getExamBlueprint } from "../../library/exams/get-exam-blueprint";
import { loadExamStructure } from "../../sessions/_utils/exam-structure";
import { readExamBlueprint } from "./exam-blueprint";

describe("request blueprint facts", () => {
  it("keeps the stored edition and structure in one canonical row", async () => {
    const blueprint = await examBlueprintFixture();

    await expect(readExamBlueprint(blueprint.id)).resolves.toStrictEqual(blueprint);
    await expect(readExamBlueprint(randomUUID())).resolves.toBeNull();
  });

  it("keeps private-source visibility at the public boundary", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const blueprint = await examBlueprintFixture({ ownerId: owner.id, visibility: "private" });

    mockSession(owner.id);

    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toMatchObject({
      id: blueprint.id,
    });

    mockSession(other.id);
    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toBeNull();

    mockSession(null);
    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toBeNull();
  });

  it("passes known blueprint and choice facts to helpers without reading them again", async () => {
    const blueprint = await examBlueprintFixture();
    const goal = { examBlueprintId: blueprint.id, id: randomUUID() };

    const counts = await countDatabaseStatements(async () =>
      Promise.all([
        loadExamStructure(goal, { blueprint, choices: [] }),
        loadExamChoiceViews({ blueprint, choices: [], examBlueprintId: blueprint.id }),
        loadTargetCutoff({ blueprint, details: {}, examBlueprintId: blueprint.id }),
      ]),
    );

    expect(counts).toMatchObject({ statements: 0, writes: 0 });

    const fresh = await countDatabaseStatements(() =>
      loadTargetCutoff({ details: {}, examBlueprintId: blueprint.id }),
    );

    expect(fresh).toMatchObject({ result: null, statements: 1, writes: 0 });
  });
});
