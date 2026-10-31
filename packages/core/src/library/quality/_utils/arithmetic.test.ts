import { describe, expect, it } from "vitest";
import { findArithmeticErrors } from "./arithmetic";

function errorsIn(text: string, language = "en"): string[] {
  return findArithmeticErrors({ language, text });
}

describe(findArithmeticErrors, () => {
  it("accepts right arithmetic in prose, LaTeX and chains", () => {
    expect(errorsIn("Divide: 20 ÷ 80 = 0.25, so the price went up 25%.")).toStrictEqual([]);
    expect(errorsIn(String.raw`\frac{20}{80} = 0.25`)).toStrictEqual([]);
    expect(errorsIn(String.raw`$100 \times 1.1^{2} = 121$`)).toStrictEqual([]);
    expect(errorsIn("300 / 2,400 = 0.125 = 12.5%")).toStrictEqual([]);
    expect(errorsIn("2^10 = 1,024")).toStrictEqual([]);
  });

  it("allows rounding to the digits shown and approximations", () => {
    expect(errorsIn("20 / 3 = 6.67")).toStrictEqual([]);
    expect(errorsIn("1 / 3 = 0.3")).toStrictEqual([]);
    expect(errorsIn("12 / 7 ≈ 1.7")).toStrictEqual([]);
  });

  it("flags wrong results", () => {
    expect(errorsIn("So 20 ÷ 80 = 0.4 of the old price.")).toHaveLength(1);
    expect(errorsIn(String.raw`\frac{2400 - 300}{2400} = 0.8`)).toHaveLength(1);
    expect(errorsIn("50 × 2 = 100 and 100 × 0.5 = 60")).toHaveLength(1);
  });

  it("reads numbers the way the lesson's language writes them", () => {
    expect(errorsIn("R$ 2.400 × 0,1 = 240", "pt")).toStrictEqual([]);
    expect(errorsIn("1.000 × 1,1 = 1.100", "pt")).toStrictEqual([]);
    expect(errorsIn(String.raw`$0{,}25 \times 80 = 20$`, "pt")).toStrictEqual([]);
    expect(errorsIn("1.000 × 1,1 = 1.200", "pt")).toHaveLength(1);
  });

  it("skips what it can't read with certainty", () => {
    expect(errorsIn("x + 3 = 7")).toStrictEqual([]);
    expect(errorsIn("3x = 12")).toStrictEqual([]);
    expect(errorsIn("R$ 80 - R$ 20 = 70", "pt")).toStrictEqual([]);
    expect(errorsIn("1/4 = 25%")).toStrictEqual([]);
    expect(errorsIn("E = mc^2")).toStrictEqual([]);
    expect(errorsIn("a = 3, b = 4")).toStrictEqual([]);
    expect(errorsIn("3 + 4 = 5 + 2")).toStrictEqual([]);
  });
});
