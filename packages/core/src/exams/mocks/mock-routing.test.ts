import { describe, expect, it } from "vitest";
import { type MockCandidate } from "./mock-plan";
import { toRouting } from "./mock-routing";

describe(toRouting, () => {
  it.each([0, 1, 3, 6, 12])("keeps both routes disjoint with %i candidates", (size) => {
    const pool: MockCandidate[] = Array.from({ length: size }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: index,
      itemId: String(index),
      skillId: "skill",
    }));

    const routes = toRouting({ pool, wanted: 4 });
    expect(routes.easier).toHaveLength(Math.min(4, Math.ceil(size / 2)));
    expect(routes.harder).toHaveLength(Math.min(4, Math.floor(size / 2)));
    expect(routes.easier.some((id) => routes.harder.includes(id))).toBe(false);
  });
});
