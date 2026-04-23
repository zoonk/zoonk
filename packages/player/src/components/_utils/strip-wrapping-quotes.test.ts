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
});
