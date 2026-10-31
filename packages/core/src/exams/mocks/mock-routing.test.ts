import { describe, expect, it } from "vitest";
import { type MockCandidate } from "./mock-plan";
import { toRouting } from "./mock-routing";

describe(toRouting, () => {
  it("keeps each subject's share in both routes when difficulties tie", () => {
    const pool: MockCandidate[] = ["Info", "Expression"].flatMap((area) =>
      Array.from({ length: 12 }, (_, index) => ({
        answered: false,
        area,
        difficulty: 0,
        itemFormat: "trueFalse" as const,
        itemId: `${area}-${index}`,
        skillId: area,
      })),
    );

    const routes = toRouting({ pool, wanted: 10 });
    expect(routes.easier.filter((id) => id.startsWith("Info"))).toHaveLength(5);
    expect(routes.harder.filter((id) => id.startsWith("Info"))).toHaveLength(5);
    expect(routes.easier.filter((id) => id.startsWith("Expression"))).toHaveLength(5);
    expect(routes.harder.filter((id) => id.startsWith("Expression"))).toHaveLength(5);
    expect(new Set([...routes.easier, ...routes.harder]).size).toBe(20);
  });

  it.each([0, 1, 3, 6, 12])("keeps both routes disjoint with %i candidates", (size) => {
    const pool: MockCandidate[] = Array.from({ length: size }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: index,
      itemFormat: "trueFalse" as const,
      itemId: String(index),
      skillId: "skill",
    }));

    const routes = toRouting({ pool, wanted: 4 });
    expect(routes.easier).toHaveLength(Math.min(4, Math.ceil(size / 2)));
    expect(routes.harder).toHaveLength(Math.min(4, Math.floor(size / 2)));
    expect(routes.easier.some((id) => routes.harder.includes(id))).toBe(false);
  });
});
