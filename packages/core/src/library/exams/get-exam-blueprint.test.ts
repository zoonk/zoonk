import { randomUUID } from "node:crypto";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getExamBlueprint } from "./get-exam-blueprint";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe(getExamBlueprint, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns a shared blueprint with its notice and content in the current shape", async () => {
    const source = await sourceFixture({ publisher: "INEP", title: "Edital ENEM 2026" });
    const blueprint = await examBlueprintFixture({ sourceId: source.id });

    const result = await getExamBlueprint({ blueprintId: blueprint.id });

    expect(result).toMatchObject({
      id: blueprint.id,
      source: { id: source.id, publisher: "INEP", title: "Edital ENEM 2026" },
    });

    // The fixture's structure predates the contract, so it reads as empty sections.
    expect(result?.structure).toStrictEqual({ formats: [], mock: null, rules: [], subjects: [] });
    expect(result?.edition.dates).toStrictEqual([]);
  });

  it("returns a blueprint read from private material only to its owner", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const blueprint = await examBlueprintFixture({
      identityKey: `private:${owner.id}:bioquimica-${randomUUID()}`,
      ownerId: owner.id,
      visibility: "private",
    });

    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toBeNull();

    mockSession(other.id);
    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toBeNull();

    mockSession(owner.id);

    await expect(getExamBlueprint({ blueprintId: blueprint.id })).resolves.toMatchObject({
      id: blueprint.id,
    });
  });

  it("returns null for unknown ids", async () => {
    await expect(getExamBlueprint({ blueprintId: "enem" })).resolves.toBeNull();
    await expect(getExamBlueprint({ blueprintId: randomUUID() })).resolves.toBeNull();
  });
});
