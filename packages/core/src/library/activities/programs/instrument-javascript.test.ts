import { describe, expect, it } from "vitest";
import { instrumentJavaScript } from "./instrument-javascript";

const READ = "() => [__zoonkRead(() => n)]";

describe(instrumentJavaScript, () => {
  it("records statements after they run, conditions as they're checked and exits before they leave", () => {
    const code = "let n = 0;\nwhile (n < 2) n++;\nif (n) return n;";

    expect(instrumentJavaScript({ code, watch: ["n"] })).toStrictEqual({
      code: [
        `let n = 0;;__zoonkStep(1, ${READ});`,
        `while (__zoonkTest(2, (n < 2), ${READ})) {n++;;__zoonkStep(2, ${READ});}`,
        `if (__zoonkTest(3, (n), ${READ})) {__zoonkStep(3, ${READ});return n;}`,
      ].join("\n"),
      ok: true,
    });
  });

  it("starts each for...of pass on the loop's line and keeps labels on their loops", () => {
    const code = "outer: for (const n of [1, 2]) {\n  continue outer;\n}";
    const result = instrumentJavaScript({ code, watch: ["n"] });

    expect(result).toStrictEqual({
      code: `outer: for (const n of [1, 2]) {__zoonkStep(1, ${READ});\n  __zoonkStep(2, ${READ});continue outer;\n}`,
      ok: true,
    });
  });

  it("reports a syntax error with its line", () => {
    expect(instrumentJavaScript({ code: "let n = 0;\nn +;", watch: ["n"] })).toMatchObject({
      error: { line: 2 },
      ok: false,
    });
  });
});
