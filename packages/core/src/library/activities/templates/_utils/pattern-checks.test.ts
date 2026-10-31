import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { regexPassesExamples } from "./pattern-checks";

describe(regexPassesExamples, () => {
  it("interrupts catastrophic backtracking while grading an answer", () => {
    const moduleUrl = new URL("../../activity-answers.ts", import.meta.url).href;
    const validationUrl = new URL("../../validate-activity.ts", import.meta.url).href;

    const source = `
      import { checkActivityAnswer } from ${JSON.stringify(moduleUrl)};
      import { validateActivity } from ${JSON.stringify(validationUrl)};
      const content = {
        check: { kind: "interaction", explanation: "" },
        fields: {
          hints: [], mode: "regex", shouldMatch: ["a".repeat(40)],
          shouldNotMatch: ["b"], solution: "^a+$", task: "Match the examples."
        },
        prompt: "Match the examples.", template: "patternTester"
      };
      const started = performance.now();
      const passed = checkActivityAnswer(content, {
        kind: "pattern", pattern: "a*".repeat(12) + "b"
      });
      const passedNegative = checkActivityAnswer({
        ...content,
        fields: { ...content.fields, shouldMatch: ["b"], shouldNotMatch: ["a".repeat(40)] }
      }, { kind: "pattern", pattern: "a*".repeat(12) + "b" });
      const recovered = checkActivityAnswer(content, { kind: "pattern", pattern: "^a+$" });
      const published = validateActivity({
        ...content, fields: { ...content.fields, solution: "a*".repeat(12) + "b" }
      }).ok;
      console.log(JSON.stringify({ elapsedMs: performance.now() - started, passed, passedNegative, published, recovered }));
    `;

    const result = spawnSync(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), "--input-type=module", "--eval", source],
      { encoding: "utf8", timeout: 2000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    expect(JSON.parse(result.stdout)).toStrictEqual({
      elapsedMs: expect.any(Number),
      passed: false,
      passedNegative: false,
      published: false,
      recovered: true,
    });

    expect(JSON.parse(result.stdout).elapsedMs).toBeLessThan(1000);
  });

  it.each([
    { passes: true, pattern: String.raw`(?<=ID:)\d+(?!\d)`, sample: "ID:42" },
    { passes: true, pattern: String.raw`^\p{L}+$`, sample: "ação" },
    { passes: true, pattern: "^.$", sample: "🦉" },
    { passes: false, pattern: "^a$", sample: "A" },
    { passes: false, pattern: "/a/i", sample: "A" },
    { passes: false, pattern: String.raw`^(a)\1$`, sample: "aa" },
    { passes: false, pattern: "(", sample: "a" },
  ])("preserves the browser's pattern rules for $pattern", ({ pattern, sample, passes }) => {
    expect(regexPassesExamples(pattern, { shouldMatch: [sample], shouldNotMatch: [""] })).toBe(
      passes,
    );
  });
});
