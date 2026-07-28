import { listCurrentUserContinueLearningItems } from "@zoonk/core/courses/list-current-user-continue-learning";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContinueLearning } from "./get-continue-learning";

vi.mock("@zoonk/core/courses/list-current-user-continue-learning", () => ({
  listCurrentUserContinueLearningItems: vi.fn(),
}));

describe(getContinueLearning, () => {
  beforeEach(() => {
    vi.mocked(listCurrentUserContinueLearningItems).mockReset();
  });

  it("degrades an optional feed failure without caching the fallback", async () => {
    vi.mocked(listCurrentUserContinueLearningItems)
      .mockRejectedValueOnce(new Error("Continue-learning query failed"))
      .mockResolvedValueOnce([]);

    await expect(getContinueLearning()).resolves.toStrictEqual([]);
    await expect(getContinueLearning()).resolves.toStrictEqual([]);
    expect(listCurrentUserContinueLearningItems).toHaveBeenCalledTimes(2);
  });
});
