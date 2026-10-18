import { describe, expect, it, vi } from "vitest";
import { draftAgainWhenFlawed } from "./draft-again";

/** Two problems in the first draft, one in any other. */
function countProblems(output: string): number {
  return output === "two problems" ? 2 : 1;
}

describe(draftAgainWhenFlawed, () => {
  it("drafts once when code finds nothing wrong", async () => {
    const draft = vi.fn().mockResolvedValue("clean");

    await expect(draftAgainWhenFlawed({ countProblems: () => 0, draft })).resolves.toBe("clean");
    expect(draft).toHaveBeenCalledOnce();
  });

  it("drafts once more when code finds problems and keeps the draft with fewer", async () => {
    const draft = vi
      .fn()
      .mockResolvedValueOnce("two problems")
      .mockResolvedValueOnce("one problem");

    await expect(draftAgainWhenFlawed({ countProblems, draft })).resolves.toBe("one problem");
    expect(draft).toHaveBeenCalledTimes(2);

    // The second draft sees the first, to be told what to avoid.
    expect(draft.mock.calls).toStrictEqual([[null], ["two problems"]]);
  });

  it("keeps the first draft on a tie and when the second draft fails", async () => {
    const tie = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    await expect(draftAgainWhenFlawed({ countProblems: () => 1, draft: tie })).resolves.toBe(
      "first",
    );

    const failing = vi.fn().mockResolvedValueOnce("first").mockRejectedValueOnce(new Error("down"));

    await expect(draftAgainWhenFlawed({ countProblems: () => 1, draft: failing })).resolves.toBe(
      "first",
    );
  });
});
