import { describe, expect, it } from "vitest";
import { type CodeToken, highlightCode } from "./highlight-code";

function kinds(line: readonly CodeToken[]): [string, string][] {
  return line.filter((token) => token.text.trim()).map((token) => [token.kind, token.text]);
}

describe(highlightCode, () => {
  it("colors Python keywords, built-ins, numbers and comments", () => {
    const [line] = highlightCode("for n in range(1, 100):  # count", "python");

    expect(kinds(line ?? [])).toStrictEqual([
      ["keyword", "for"],
      ["plain", "n"],
      ["keyword", "in"],
      ["builtin", "range"],
      ["plain", "("],
      ["number", "1"],
      ["plain", ","],
      ["number", "100"],
      ["plain", "):"],
      ["comment", "# count"],
    ]);
  });

  it("keeps the text of every line exactly, including indentation", () => {
    const code = "total = 0\nfor n in range(3):\n    total += n\nprint(total)";
    const lines = highlightCode(code, "python");

    expect(lines.map((line) => line.map((token) => token.text).join(""))).toStrictEqual(
      code.split("\n"),
    );
  });

  it("keeps empty lines", () => {
    expect(highlightCode("a = 1\n\nb = 2", "python")).toHaveLength(3);
  });

  it("colors a string spanning lines on each line", () => {
    const lines = highlightCode('s = """one\ntwo"""', "python");

    expect(kinds(lines[0] ?? []).at(-1)).toStrictEqual(["string", '"""one']);
    expect(kinds(lines[1] ?? [])).toStrictEqual([["string", 'two"""']]);
  });

  it("colors JavaScript strings and template literals, and leaves identifiers plain", () => {
    const [line] = highlightCode("const mid = Math.floor(`lo` + 'x');", "javascript");

    expect(kinds(line ?? [])).toContainEqual(["keyword", "const"]);
    expect(kinds(line ?? [])).toContainEqual(["builtin", "Math"]);
    expect(kinds(line ?? [])).toContainEqual(["string", "`lo`"]);
    expect(kinds(line ?? [])).toContainEqual(["string", "'x'"]);
    expect(kinds(line ?? [])).toContainEqual(["plain", "mid"]);
  });

  it("reads SQL keywords in any case", () => {
    const [line] = highlightCode("select name FROM countries where pop > 200 -- big", "sql");

    expect(kinds(line ?? [])).toStrictEqual([
      ["keyword", "select"],
      ["plain", "name"],
      ["keyword", "FROM"],
      ["plain", "countries"],
      ["keyword", "where"],
      ["plain", "pop"],
      ["plain", ">"],
      ["number", "200"],
      ["comment", "-- big"],
    ]);
  });

  it("colors an unfinished string to the end of the line while the learner types", () => {
    const [line] = highlightCode("WHERE continent = 'Asi", "sql");
    expect(kinds(line ?? []).at(-1)).toStrictEqual(["string", "'Asi"]);
  });
});
