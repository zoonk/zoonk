import { describe, expect, it } from "vitest";
import { toPromptProduct } from "./course-product";

function course(releasedAt: string, releasedMonthOnly: boolean) {
  return {
    product: { name: "Orbit Notes", organization: { name: "Lumen Works" } },
    productRelease: { name: "Orbit Notes 5", releasedAt: new Date(releasedAt), releasedMonthOnly },
  };
}

describe(toPromptProduct, () => {
  it("dates the release a course teaches only as precisely as its pages do", () => {
    expect(
      [course("2025-10-21", false), course("2025-10-01", true)].map(
        (item) => toPromptProduct(item)?.release?.releasedOn,
      ),
    ).toStrictEqual(["2025-10-21", "2025-10"]);
  });
});
