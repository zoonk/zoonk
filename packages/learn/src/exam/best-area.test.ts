import { describe, expect, it } from "vitest";
import { findBestArea } from "./best-area";

describe(findBestArea, () => {
  it("names the subject whose latest mock went best", () => {
    expect(
      findBestArea([
        { name: "Linguagens", percents: [80, 62] },
        { name: "Matemática", percents: [40, 75] },
      ]),
    ).toStrictEqual({ name: "Matemática", percent: 75 });
  });

  it("names none when the top share is tied, or there's nothing to compare", () => {
    expect(
      findBestArea([
        { name: "Linguagens", percents: [70] },
        { name: "Ciências Humanas", percents: [70] },
      ]),
    ).toBeNull();

    expect(findBestArea([{ name: "Linguagens", percents: [70] }])).toBeNull();
    expect(findBestArea([{ name: "Linguagens", percents: [] }])).toBeNull();
  });
});
