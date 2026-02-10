import { describe, expect, test } from "vitest";
import {
  emptyToNull,
  formatPosition,
  normalizeString,
  parseBigIntId,
  parseNumericId,
  removeAccents,
} from "./string";

describe(removeAccents, () => {
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
    expect(removeAccents("Français, Español, Português")).toBe("Francais, Espanol, Portugues");
  });
});

describe(normalizeString, () => {
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

describe(parseNumericId, () => {
  test("parses valid numeric strings", () => {
    expect(parseNumericId("123")).toBe(123);
    expect(parseNumericId("0")).toBe(0);
    expect(parseNumericId("999999")).toBe(999_999);
  });

  test("returns null for strings with letters", () => {
    expect(parseNumericId("123abc")).toBeNull();
    expect(parseNumericId("abc123")).toBeNull();
    expect(parseNumericId("1a2b3c")).toBeNull();
  });

  test("returns null for strings with special characters", () => {
    expect(parseNumericId("123.45")).toBeNull();
    expect(parseNumericId("123-45")).toBeNull();
    expect(parseNumericId("123_45")).toBeNull();
    expect(parseNumericId("+123")).toBeNull();
    expect(parseNumericId("-123")).toBeNull();
  });

  test("returns null for strings with whitespace", () => {
    expect(parseNumericId(" 123")).toBeNull();
    expect(parseNumericId("123 ")).toBeNull();
    expect(parseNumericId(" 123 ")).toBeNull();
    expect(parseNumericId("12 34")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseNumericId("")).toBeNull();
  });
});

describe(parseBigIntId, () => {
  test("parses valid numeric strings as BigInt", () => {
    expect(parseBigIntId("123")).toBe(BigInt(123));
    expect(parseBigIntId("0")).toBe(BigInt(0));
    expect(parseBigIntId("999999")).toBe(BigInt(999_999));
  });

  test("parses large numbers that exceed Number.MAX_SAFE_INTEGER", () => {
    const largeNum = "9007199254740993";
    expect(parseBigIntId(largeNum)).toBe(BigInt(largeNum));
  });

  test("returns null for strings with letters", () => {
    expect(parseBigIntId("123abc")).toBeNull();
    expect(parseBigIntId("abc123")).toBeNull();
    expect(parseBigIntId("1a2b3c")).toBeNull();
  });

  test("returns null for strings with special characters", () => {
    expect(parseBigIntId("123.45")).toBeNull();
    expect(parseBigIntId("123-45")).toBeNull();
    expect(parseBigIntId("123_45")).toBeNull();
    expect(parseBigIntId("+123")).toBeNull();
    expect(parseBigIntId("-123")).toBeNull();
  });

  test("returns null for strings with whitespace", () => {
    expect(parseBigIntId(" 123")).toBeNull();
    expect(parseBigIntId("123 ")).toBeNull();
    expect(parseBigIntId(" 123 ")).toBeNull();
    expect(parseBigIntId("12 34")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseBigIntId("")).toBeNull();
  });
});

describe(emptyToNull, () => {
  test("converts empty string to null", () => {
    expect(emptyToNull("")).toBeNull();
  });

  test("converts whitespace-only string to null", () => {
    expect(emptyToNull("  ")).toBeNull();
  });

  test("converts null to null", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  test("converts undefined to null", () => {
    expect(emptyToNull()).toBeNull();
  });

  test("returns non-empty string as-is", () => {
    expect(emptyToNull("romaji")).toBe("romaji");
  });
});

describe(formatPosition, () => {
  test("formats single digit positions with leading zero", () => {
    expect(formatPosition(0)).toBe("01");
    expect(formatPosition(8)).toBe("09");
  });

  test("formats double digit positions without leading zero", () => {
    expect(formatPosition(9)).toBe("10");
    expect(formatPosition(99)).toBe("100");
  });
});
