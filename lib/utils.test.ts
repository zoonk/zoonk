import { describe, expect, test } from "vitest";

import { normalizeString, removeAccents } from "@/lib/utils";

describe("removeAccents", () => {
  test("removes diacritics from string", () => {
    expect(removeAccents("café")).toBe("cafe");
    expect(removeAccents("naïve")).toBe("naive");
    expect(removeAccents("São Paulo")).toBe("Sao Paulo");
    expect(removeAccents("Zürich")).toBe("Zurich");
    expect(removeAccents("José")).toBe("Jose");
  });

  test("preserves strings without accents", () => {
    expect(removeAccents("hello")).toBe("hello");
    expect(removeAccents("world")).toBe("world");
    expect(removeAccents("123")).toBe("123");
  });

  test("handles empty string", () => {
    expect(removeAccents("")).toBe("");
  });

  test("handles mixed characters", () => {
    expect(removeAccents("Olá, tudo bem?")).toBe("Ola, tudo bem?");
    expect(removeAccents("Français, Español, Português")).toBe(
      "Francais, Espanol, Portugues",
    );
  });
});

describe("normalizeString", () => {
  test("removes accents and converts to lowercase", () => {
    expect(normalizeString("CAFÉ")).toBe("cafe");
    expect(normalizeString("São Paulo")).toBe("sao paulo");
    expect(normalizeString("José")).toBe("jose");
  });

  test("trims whitespace", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
    expect(normalizeString("  world  ")).toBe("world");
  });

  test("replaces multiple spaces with single space", () => {
    expect(normalizeString("hello    world")).toBe("hello world");
    expect(normalizeString("foo  bar   baz")).toBe("foo bar baz");
  });

  test("handles combined transformations", () => {
    expect(normalizeString("  CAFÉ  COM  LEITE  ")).toBe("cafe com leite");
    expect(normalizeString("  São   Paulo   ")).toBe("sao paulo");
  });

  test("removes special characters", () => {
    expect(normalizeString("Café! @Home #1")).toBe("cafe! @home #1");
    expect(normalizeString("  Hello, World!  ")).toBe("hello, world!");
  });

  test("handles empty string", () => {
    expect(normalizeString("")).toBe("");
  });

  test("handles string with only spaces", () => {
    expect(normalizeString("   ")).toBe("");
  });
});
