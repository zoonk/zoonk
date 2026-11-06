import { describe, expect, it } from "vitest";
import { countScreenCharacters, getScreenCharacterLimit } from "./screen-length";

describe(countScreenCharacters, () => {
  it("counts letters and accents once and Chinese, Japanese and Korean characters twice", () => {
    expect(countScreenCharacters("Coração, átrio")).toBe(14);
    expect(countScreenCharacters("Çok güzel, şöyle")).toBe(16);
    expect(countScreenCharacters("心臓の部屋")).toBe(10);
    expect(countScreenCharacters("심장 구조")).toBe(9);
  });

  it("leaves out the markup the learner never reads", () => {
    expect(countScreenCharacters("**Septo** é `x`")).toBe(9);
    expect(countScreenCharacters(String.raw`$\frac{a}{b}$`)).toBe(3);
  });
});

describe(getScreenCharacterLimit, () => {
  it("halves the cap for languages whose script counts twice", () => {
    expect(getScreenCharacterLimit("pt")).toBe(250);
    expect(getScreenCharacterLimit("tr")).toBe(250);
    expect(getScreenCharacterLimit("ja")).toBe(125);
    expect(getScreenCharacterLimit("ko")).toBe(125);
  });
});
