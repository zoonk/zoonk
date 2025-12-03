import { describe, expect, test } from "vitest";

import { normalizeString, removeAccents, toRegex } from "./string";

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

describe("toRegex", () => {
  test("escapes dots in the pattern", () => {
    const regex = toRegex("example.com");
    expect(regex.test("example.com")).toBe(true);
    expect(regex.test("exampleXcom")).toBe(false);
  });

  test("matches exact domain", () => {
    const regex = toRegex("zoonk.com");
    expect(regex.test("zoonk.com")).toBe(true);
    expect(regex.test("www.zoonk.com")).toBe(false);
    expect(regex.test("zoonk.com.br")).toBe(false);
  });

  test("handles wildcard subdomain pattern", () => {
    const regex = toRegex("*.zoonk.com");
    expect(regex.test("www.zoonk.com")).toBe(true);
    expect(regex.test("app.zoonk.com")).toBe(true);
    expect(regex.test("api.zoonk.com")).toBe(true);
    expect(regex.test("zoonk.com")).toBe(false);
  });

  test("handles multiple subdomain levels with wildcard", () => {
    const regex = toRegex("*.example.com");
    expect(regex.test("sub.example.com")).toBe(true);
    expect(regex.test("deep.sub.example.com")).toBe(true);
    expect(regex.test("example.com")).toBe(false);
  });

  test("handles pattern with protocol-like prefix", () => {
    const regex = toRegex("https://example.com");
    expect(regex.test("https://example.com")).toBe(true);
    expect(regex.test("http://example.com")).toBe(false);
  });

  test("handles complex patterns with multiple dots", () => {
    const regex = toRegex("api.v1.example.com");
    expect(regex.test("api.v1.example.com")).toBe(true);
    expect(regex.test("api.v2.example.com")).toBe(false);
  });

  test("anchors pattern to start and end", () => {
    const regex = toRegex("example.com");
    expect(regex.test("example.com")).toBe(true);
    expect(regex.test("prefix.example.com")).toBe(false);
    expect(regex.test("example.com.suffix")).toBe(false);
    expect(regex.test("prefix.example.com.suffix")).toBe(false);
  });

  test("handles empty string", () => {
    const regex = toRegex("");
    expect(regex.test("")).toBe(true);
    expect(regex.test("anything")).toBe(false);
  });
});
