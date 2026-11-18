import { describe, expect, it } from "vitest";
import { parseRichInline } from "./rich-text-parser";

describe(parseRichInline, () => {
  it("keeps an English period and comma beside an inline code chip", () => {
    const segments = parseRichInline(
      "Write `Plants need water` . Then change `need` , not `water`.",
    );

    expect(segments.map(({ text }) => text).join("")).toBe(
      "Write Plants need water. Then change need, not water.",
    );
  });

  it("keeps French spacing after an inline code chip", () => {
    const segments = parseRichInline(
      "Que fait `print` ? Regardez `x` : la valeur de `y` ; essayez `z` !",
    );

    expect(segments.map(({ text }) => text).join("")).toBe(
      "Que fait print ? Regardez x : la valeur de y ; essayez z !",
    );
  });
});
