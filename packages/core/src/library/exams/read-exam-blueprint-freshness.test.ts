import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { type getCachedBlueprintRow } from "./_utils/cached-blueprint-row";
import { readExamBlueprint } from "./read-exam-blueprint";

// Vitest does not run Next's cache transform. Retain this platform boundary's result by its
// serialized arguments, as Main does when the API writes without expiring Main's cache.
vi.mock("./_utils/cached-blueprint-row", async (importOriginal) => {
  const actual = await importOriginal<{ getCachedBlueprintRow: typeof getCachedBlueprintRow }>();
  const entries = new Map<string, ReturnType<typeof actual.getCachedBlueprintRow>>();

  return {
    getCachedBlueprintRow: (input: Parameters<typeof actual.getCachedBlueprintRow>[0]) => {
      const key = JSON.stringify(input);
      const entry = entries.get(key) ?? actual.getCachedBlueprintRow(input);
      entries.set(key, entry);
      return entry;
    },
  };
});

describe("blueprints changed by another app", () => {
  it("shows the new exam date even while Main retains the previous row", async () => {
    const blueprint = await examBlueprintFixture({ examDate: new Date("2027-01-10") });
    const before = await readExamBlueprint(blueprint.id);
    expect(before?.examDate).toStrictEqual(blueprint.examDate);

    const updated = await prisma.examBlueprint.update({
      data: {
        examDate: new Date("2027-02-20"),
        updatedAt: new Date(blueprint.updatedAt.getTime() + 1000),
      },
      where: { id: blueprint.id },
    });

    const after = await readExamBlueprint(blueprint.id);
    expect(after?.examDate).toStrictEqual(updated.examDate);
  });
});
