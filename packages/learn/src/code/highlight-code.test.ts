import { describe, expect, it } from "vitest";
import { type CodeToken, highlightCode } from "./highlight-code";

function colored(line: readonly CodeToken[] | undefined): [string, string][] {
  return (line ?? [])
    .filter((token) => token.kind !== "plain")
    .map((token) => [token.kind, token.text]);
}

function coloredLine(code: string, language: string | null): [string, string][] {
  return colored(highlightCode(code, language)[0]);
}

describe(highlightCode, () => {
  it("colors Python keywords, built-ins, numbers and comments", () => {
    expect(coloredLine("for n in range(1, 100):  # count", "python")).toStrictEqual([
      ["keyword", "for"],
      ["keyword", "in"],
      ["builtin", "range"],
      ["number", "1"],
      ["number", "100"],
      ["comment", "# count"],
    ]);
  });

  it("keeps the text of every line exactly, including indentation", () => {
    const code = "total = 0\nfor n in range(3):\n    total += n\n\tprint(total)  ";
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

    expect(colored(lines[0])).toStrictEqual([["string", '"""one']]);
    expect(colored(lines[1])).toStrictEqual([["string", 'two"""']]);
  });

  it("colors JavaScript strings and template literals, and leaves identifiers plain", () => {
    expect(coloredLine("const mid = Math.floor(`lo` + 'x');", "javascript")).toStrictEqual([
      ["keyword", "const"],
      ["builtin", "Math"],
      ["string", "`lo`"],
      ["string", "'x'"],
    ]);
  });

  it("leaves a name after a dot plain, since it's a property", () => {
    expect(coloredLine("console.log(event.type, list.delete)", "ts")).toStrictEqual([
      ["builtin", "console"],
    ]);
  });

  it("reads SQL keywords in any case", () => {
    expect(coloredLine("select name FROM countries where pop > 200 -- big", "sql")).toStrictEqual([
      ["keyword", "select"],
      ["keyword", "FROM"],
      ["keyword", "where"],
      ["number", "200"],
      ["comment", "-- big"],
    ]);
  });

  it("colors an unfinished string to the end of the line while the learner types", () => {
    expect(coloredLine("WHERE continent = 'Asi", "sql").at(-1)).toStrictEqual(["string", "'Asi"]);
  });

  it("reads the names writers give a fence, in any case", () => {
    const python = coloredLine("def f(): return None", "python");

    expect(coloredLine("def f(): return None", "py")).toStrictEqual(python);
    expect(coloredLine("def f(): return None", "Python3")).toStrictEqual(python);
    expect(coloredLine("let x = 1", "JS")).toStrictEqual(coloredLine("let x = 1", "javascript"));
  });

  it("colors TypeScript's own keywords and types, which JavaScript leaves plain", () => {
    const code = "type Id = string; interface User { id: Id }";

    expect(coloredLine(code, "typescript")).toStrictEqual([
      ["keyword", "type"],
      ["builtin", "string"],
      ["keyword", "interface"],
    ]);

    expect(coloredLine(code, "javascript")).toStrictEqual([]);
  });

  it("colors Java and C, with C's preprocessor lines", () => {
    expect(
      coloredLine("public static void main(String[] args) { int n = 2; }", "java"),
    ).toStrictEqual([
      ["keyword", "public"],
      ["keyword", "static"],
      ["keyword", "void"],
      ["builtin", "String"],
      ["keyword", "int"],
      ["number", "2"],
    ]);

    expect(coloredLine("#include <stdio.h>", "c")).toStrictEqual([["keyword", "#include"]]);

    expect(coloredLine(String.raw`printf("%d\n", x); // print`, "cpp")).toStrictEqual([
      ["builtin", "printf"],
      ["string", String.raw`"%d\n"`],
      ["comment", "// print"],
    ]);
  });

  it("colors HTML's tags and attribute values, never an apostrophe in its text", () => {
    expect(coloredLine('<a href="/home">It\'s here</a> <!-- nav -->', "html")).toStrictEqual([
      ["keyword", "a"],
      ["string", '"/home"'],
      ["keyword", "a"],
      ["comment", "<!-- nav -->"],
    ]);
  });

  it("colors CSS's at-rules, numbers with units and comments", () => {
    expect(
      coloredLine("@media (width > 40rem) { margin: -4px 50%; } /* wide */", "css"),
    ).toStrictEqual([
      ["keyword", "@media"],
      ["number", "40rem"],
      ["number", "-4px"],
      ["number", "50%"],
      ["comment", "/* wide */"],
    ]);
  });

  it("colors nothing in program output", () => {
    expect(coloredLine("It's 42 # not a comment", "text")).toStrictEqual([]);
    expect(coloredLine("Total: 3 // done", "output")).toStrictEqual([]);
  });

  it("colors only strings, numbers and comments in a language it doesn't know", () => {
    expect(coloredLine('fn main() { let s = "oi"; } // 2 items', "rust")).toStrictEqual([
      ["string", '"oi"'],
      ["comment", "// 2 items"],
    ]);

    expect(coloredLine("for x in [1, 2]:  # loop", null)).toStrictEqual([
      ["number", "1"],
      ["number", "2"],
      ["comment", "# loop"],
    ]);

    expect(coloredLine("SELECT 1 -- one", null)).toStrictEqual([
      ["number", "1"],
      ["comment", "-- one"],
    ]);
  });

  it("doesn't take a URL, a directive, a decrement or an apostrophe for a comment or a string", () => {
    expect(coloredLine("curl https://zoonk.com/api", "bash")).toStrictEqual([]);
    expect(coloredLine("#include <math.h>", "objective-c")).toStrictEqual([]);
    expect(coloredLine("i--;", null)).toStrictEqual([]);
    expect(coloredLine("Don't stop, it's fine", null)).toStrictEqual([]);
  });
});
