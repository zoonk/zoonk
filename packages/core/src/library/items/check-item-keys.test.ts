import { type ItemSolution, solveItems } from "@zoonk/ai/tasks/items/solve";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIR_FRYER_EXAM, AIR_FRYER_ITEM, OVEN_ITEM } from "./_test-utils/air-fryer-batch";
import { generatedMultipleChoice, generatedTypedItem } from "./_test-utils/generated-items";
import { checkItemKeys } from "./check-item-keys";

vi.mock("@zoonk/ai/tasks/items/solve", () => ({ solveItems: vi.fn() }));

function solvedAs(solutions: (ItemSolution | null)[]) {
  vi.mocked(solveItems).mockResolvedValue({ data: { solutions } } as never);
}

describe(checkItemKeys, () => {
  beforeEach(() => {
    vi.mocked(solveItems).mockReset();
  });

  it("drops the air fryer, whose right cost no option shows, and keeps the oven written beside it", async () => {
    solvedAs([
      { format: "multipleChoice", picks: [], work: "1,2 kW × 0,5 h × 25 × R$ 0,80 = R$ 12,00." },
      {
        format: "multipleChoice",
        picks: [0],
        work: "R$ 18 ÷ 0,90 = 20 kWh; 20 ÷ 1,5 ÷ 30 = 4/9 h.",
      },
    ]);

    const { dropped, kept } = await checkItemKeys({
      ...AIR_FRYER_EXAM,
      items: [AIR_FRYER_ITEM, OVEN_ITEM],
    });

    expect(solveItems).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ items: [AIR_FRYER_ITEM, OVEN_ITEM] }),
    );

    expect(dropped).toStrictEqual([
      {
        index: 0,
        reason: "The solver found no right option: 1,2 kW × 0,5 h × 25 × R$ 0,80 = R$ 12,00.",
      },
    ]);

    expect(kept).toStrictEqual([{ index: 1, item: OVEN_ITEM }]);
  });

  it("solves only the choices that pass the item checks and keeps other formats as written", async () => {
    const good = generatedMultipleChoice();
    const typed = generatedTypedItem();

    const twoRight = generatedMultipleChoice({
      options: good.options.map((option) => ({ ...option, isCorrect: true })),
    });

    solvedAs([{ format: "multipleChoice", picks: [0], work: "Half of 10 is 5." }]);

    const { dropped, kept } = await checkItemKeys({
      items: [twoRight, typed, good],
      language: "en",
    });

    expect(solveItems).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ items: [good] }));
    expect(dropped).toStrictEqual([{ index: 0, reason: "Has 2 correct options instead of 1." }]);

    expect(kept).toStrictEqual([
      { index: 1, item: typed },
      { index: 2, item: good },
    ]);
  });

  it("makes no model call when nothing needs a key check", async () => {
    const typed = generatedTypedItem();

    await expect(checkItemKeys({ items: [typed], language: "en" })).resolves.toStrictEqual({
      dropped: [],
      kept: [{ index: 0, item: typed }],
    });

    expect(solveItems).not.toHaveBeenCalled();
  });
});
