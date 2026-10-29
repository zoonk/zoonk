import { describe, expect, it } from "vitest";
import { runRegexExamples } from "./regex-examples";
import { runRegexExamples as runBrowserExamples } from "./regex-examples.browser";

describe(runRegexExamples, () => {
  it.each([
    { flags: "u", shouldMatch: ["aa"], shouldNotMatch: ["ab"], source: String.raw`^(a)\1$` },
    {
      flags: "u",
      shouldMatch: ["same same"],
      shouldNotMatch: ["same other"],
      source: String.raw`^(?<word>\w+) \k<word>$`,
    },
    { flags: "u", shouldMatch: ["ab"], shouldNotMatch: ["abc"], source: "(?<=a)b(?!c)" },
    { flags: "iu", shouldMatch: ["É"], shouldNotMatch: ["e"], source: "^é$" },
    { flags: "su", shouldMatch: ["a\nb"], shouldNotMatch: ["ab"], source: "^a.b$" },
    { flags: "mu", shouldMatch: ["x\na"], shouldNotMatch: ["ba"], source: "^a$" },
    { flags: "u", shouldMatch: ["🦉"], shouldNotMatch: ["ab"], source: "^.$" },
    { flags: "gu", shouldMatch: ["a", "a"], shouldNotMatch: [], source: "a" },
    { flags: "yu", shouldMatch: ["a", "a"], shouldNotMatch: [], source: "a" },
  ])("keeps JavaScript semantics for /$source/$flags", ({ flags, source, ...examples }) => {
    expect(runRegexExamples(new RegExp(source, flags), examples)).toBe(
      runBrowserExamples(new RegExp(source, flags), examples),
    );
  });

  it("treats pattern text as data, never executable JavaScript", () => {
    const text = '"); throw new Error("injected"); //';
    const regex = new RegExp(text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`), "u");

    expect(runRegexExamples(regex, { shouldMatch: [text], shouldNotMatch: ["other"] })).toBe(true);
  });
});
