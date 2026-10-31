import { describe, expect, it } from "vitest";
import { getToolKey } from "./chapter-tools";

describe(getToolKey, () => {
  it("names one tool once, whatever the case, accents or the choices it lists", () => {
    const keys = ["Python", "python ", "Python (NumPy e SciPy)", "PYTHON (numpy)"].map((name) =>
      getToolKey(name),
    );

    expect(new Set(keys)).toStrictEqual(new Set(["python"]));

    expect(getToolKey("Planilha eletrônica (Google Sheets ou Excel)")).toBe(
      getToolKey("planilha eletronica"),
    );
  });

  it("keeps different tools apart", () => {
    expect(getToolKey("Python")).not.toBe(getToolKey("R"));
    expect(getToolKey("(Excel)")).toBe("(excel)");
  });
});
