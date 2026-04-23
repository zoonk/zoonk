import { describe, expect, test } from "vitest";
import { stripWrappingQuotes } from "./strip-wrapping-quotes";

describe(stripWrappingQuotes, () => {
  test("removes one outer pair of matching quotes", () => {
    expect(stripWrappingQuotes('  "hello there"  ')).toBe("hello there");
    expect(stripWrappingQuotes("“hello there”")).toBe("hello there");
    expect(stripWrappingQuotes("‘hello there’")).toBe("hello there");
  });

  test("leaves unmatched or inner quotes alone", () => {
    expect(stripWrappingQuotes('"hello there')).toBe('"hello there');
    expect(stripWrappingQuotes('He said "wait" and left.')).toBe('He said "wait" and left.');
  });

  test("leaves lone quote characters alone", () => {
    expect(stripWrappingQuotes('"')).toBe('"');
    expect(stripWrappingQuotes("'")).toBe("'");
    expect(stripWrappingQuotes('  "  ')).toBe('  "  ');
  });

  test("strips outer single quotes when the inner text only has apostrophes", () => {
    expect(stripWrappingQuotes("'It's ready'")).toBe("It's ready");
    expect(stripWrappingQuotes("‘It’s ready’")).toBe("It’s ready");
  });

  test("preserves quotes around the first and last words", () => {
    expect(stripWrappingQuotes('"this" should preserve quotes in the first and last "words"')).toBe(
      '"this" should preserve quotes in the first and last "words"',
    );
    expect(stripWrappingQuotes("“this” should preserve quotes in the first and last “words”")).toBe(
      "“this” should preserve quotes in the first and last “words”",
    );
    expect(stripWrappingQuotes("'this' should preserve quotes in the first and last 'words'")).toBe(
      "'this' should preserve quotes in the first and last 'words'",
    );
    expect(stripWrappingQuotes("‘this’ should preserve quotes in the first and last ‘words’")).toBe(
      "‘this’ should preserve quotes in the first and last ‘words’",
    );
  });
});
