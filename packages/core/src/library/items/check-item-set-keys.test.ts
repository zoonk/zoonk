import { type ItemSolution, solveItems } from "@zoonk/ai/tasks/items/solve";
import { prisma } from "@zoonk/db";
import { listeningContent } from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generatedMultipleChoice,
  generatedProvenance,
  generatedTypedItem,
  writtenItemSet,
} from "./_test-utils/generated-items";
import { checkItemSetKeys, toItemSetStimulus } from "./check-item-set-keys";
import { createItemSet } from "./create-item-set";
import { prepareWrittenItemSet } from "./prepare-item-set";

vi.mock("@zoonk/ai/tasks/items/solve", () => ({ solveItems: vi.fn() }));

function solvedAs(verdicts: (boolean | null)[]) {
  const solutions: ItemSolution[] = verdicts.map((isTrue) => ({
    format: "trueFalse",
    isTrue,
    work: "From the passage.",
  }));

  vi.mocked(solveItems).mockResolvedValue({ data: { solutions } } as never);
}

async function writtenLibrarySet() {
  const [reading, inference] = await Promise.all([skillFixture(), skillFixture()]);
  const written = writtenItemSet();

  const set = prepareWrittenItemSet({
    examBlueprintId: null,
    format: "trueFalse",
    language: "en",
    provenance: generatedProvenance(),
    skillIds: [reading.id, inference.id],
    written,
  });

  return { inference, reading, set: set!, written };
}

describe(checkItemSetKeys, () => {
  beforeEach(() => {
    vi.mocked(solveItems).mockReset();
  });

  it("solves the questions with their passage and stores only those whose key the solve reached", async () => {
    const { reading, set, written } = await writtenLibrarySet();
    solvedAs([true, true, true]);

    const checked = await checkItemSetKeys({ set });

    expect(solveItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        items: set.items.map(({ item }) => item),
        stimulus: `Sundays at the library\n\n${written.text}`,
      }),
    );

    const { set: stored } = await createItemSet(checked);

    expect(stored?.items.map((item) => [item.setPosition, item.skillId])).toStrictEqual([
      [0, reading.id],
      [1, reading.id],
    ]);
  });

  it("stores no set when the questions left fall below its minimum", async () => {
    const { set } = await writtenLibrarySet();
    solvedAs([true, true, false]);

    const checked = await checkItemSetKeys({ set });

    expect(checked.items).toHaveLength(1);
    await expect(createItemSet(checked)).resolves.toMatchObject({ set: null });

    await expect(prisma.itemSet.count({ where: { runId: set.provenance.runId } })).resolves.toBe(0);
  });

  it("solves a recording's choices from its script, keeping typed answers as written", async () => {
    const skill = await skillFixture();
    const choice = generatedMultipleChoice();
    const typed = generatedTypedItem();

    vi.mocked(solveItems).mockResolvedValue({
      data: { solutions: [{ format: "multipleChoice", picks: [0], work: "Half of 10 is 5." }] },
    } as never);

    const checked = await checkItemSetKeys({
      set: {
        content: listeningContent({ uniqueLine: "My booking number is 42." }),
        items: [
          { format: "typed", item: typed, skillId: skill.id },
          { format: "multipleChoice", item: choice, skillId: skill.id },
        ],
        kind: "audio",
        language: "pt",
        optionLanguage: "en",
        provenance: generatedProvenance(),
      },
    });

    expect(solveItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        items: [choice],
        stimulus: [
          "Booking a hall",
          "Receptionist: Good morning, Riverside Sports Centre. How can I help?",
          "Tom: I'd like to book the small hall, please. My booking number is 42.",
          "Receptionist: Which day were you thinking of?",
          "Tom: Tuesday, no, sorry, Thursday the twelfth.",
        ].join("\n"),
      }),
    );

    expect(checked.items.map(({ item }) => item)).toStrictEqual([typed, choice]);
  });
});

describe(toItemSetStimulus, () => {
  it("gives a chart set's data with its title and text", () => {
    const visual = {
      axisStart: null,
      categories: ["2024", "2025"],
      categoryLabel: "Year",
      chart: "bar" as const,
      kind: "chart" as const,
      series: [{ name: "Visits", values: [300, 400] }],
      source: null,
      title: "Library visits",
      unit: null,
      valueLabel: "Visits",
    };

    expect(
      toItemSetStimulus({
        content: { source: null, text: null, title: "Sundays at the library", visual },
        kind: "chart",
      }),
    ).toBe(`Sundays at the library\n\n${JSON.stringify(visual)}`);
  });
});
