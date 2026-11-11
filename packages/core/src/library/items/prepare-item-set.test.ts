import { toSetItem } from "@zoonk/ai/tasks/items/write-set";
import { describe, expect, it } from "vitest";
import { generatedProvenance, writtenItemSet } from "./_test-utils/generated-items";
import { prepareWrittenItemSet } from "./prepare-item-set";

const SHARED = {
  examBlueprintId: "blueprint-1",
  format: "trueFalse" as const,
  language: "en",
  provenance: generatedProvenance(),
};

describe(prepareWrittenItemSet, () => {
  it("keeps the passage and the questions that pass in order, each on the skill its number names", () => {
    const written = writtenItemSet();
    const [first, second, third] = written.questions;

    const prepared = prepareWrittenItemSet({
      ...SHARED,
      skillIds: ["reading", "inference"],
      written: {
        ...written,
        questions: [first!, { ...second!, evidence: "Visits doubled." }, third!],
      },
    });

    expect(prepared).toMatchObject({
      content: { source: null, text: written.text, title: "Sundays at the library" },
      examBlueprintId: "blueprint-1",
      kind: "text",
      minItems: 2,
    });

    expect(
      prepared?.items.map(({ format, item, skillId }) => [format, item, skillId]),
    ).toStrictEqual([
      ["trueFalse", toSetItem(first!), "reading"],
      ["trueFalse", toSetItem(third!), "reading"],
    ]);
  });

  it("prepares nothing when its stimulus fails, or fewer than two questions pass", () => {
    const written = writtenItemSet();
    const skillIds = ["reading", "inference"];

    expect(
      prepareWrittenItemSet({
        ...SHARED,
        skillIds,
        written: { ...written, text: "Visits had risen by a third." },
      }),
    ).toBeNull();

    expect(
      prepareWrittenItemSet({
        ...SHARED,
        skillIds,
        written: { ...written, questions: written.questions.slice(0, 1) },
      }),
    ).toBeNull();
  });
});
