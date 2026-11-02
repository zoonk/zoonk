import { describe, expect, it } from "vitest";
import { formatConsoleArgs } from "./console-values";

describe(formatConsoleArgs, () => {
  it("prints strings as they are and joins arguments with spaces", () => {
    expect(formatConsoleArgs(["total:", 5050, true, null])).toBe("total: 5050 true null");
  });

  it("prints arrays and objects on one line like Node, quoting nested strings", () => {
    expect(formatConsoleArgs([[2, 4, "six"]])).toBe("[ 2, 4, 'six' ]");
    expect(formatConsoleArgs([[]])).toBe("[]");

    expect(
      formatConsoleArgs([
        {
          $zoonk: "object",
          entries: [
            ["name", "Ana"],
            ["first-day", 1],
          ],
          name: "",
        },
      ]),
    ).toBe("{ name: 'Ana', 'first-day': 1 }");
  });

  it("names class instances, functions, maps and sets", () => {
    expect(formatConsoleArgs([{ $zoonk: "object", entries: [["x", 1]], name: "Point" }])).toBe(
      "Point { x: 1 }",
    );

    expect(formatConsoleArgs([{ $zoonk: "function", name: "add" }])).toBe("[Function: add]");

    expect(formatConsoleArgs([{ $zoonk: "map", entries: [["a", 1]] }])).toBe("Map(1) { 'a' => 1 }");

    expect(formatConsoleArgs([{ $zoonk: "set", values: [1, 2] }])).toBe("Set(2) { 1, 2 }");
  });

  it("marks what it can't print in full", () => {
    expect(formatConsoleArgs([{ $zoonk: "undefined" }, [{ $zoonk: "circular" }]])).toBe(
      "undefined [ [Circular] ]",
    );
  });

  it("uses double quotes for nested strings with an apostrophe", () => {
    expect(formatConsoleArgs([["it's"]])).toBe(`[ "it's" ]`);
  });
});
