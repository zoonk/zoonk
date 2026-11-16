/* oxlint-disable no-magic-numbers -- The fixtures are native control measurements. */
import assert from "node:assert/strict";
import { test } from "vitest";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { readCaptures } from "./alignment-validate.mts";
import { evaluateCapture } from "./alignment.mts";

test("keeps native measurement limits with their platform and reason", () => {
  for (const platform of ["apple", "android"] as const) {
    const capture = {
      ...fixtureCapture([]),
      measurements: ["clipping", "controls", "text-flows"] as const,
      notMeasured: {
        clipping: "the view tree hides clip boundaries",
        "text-flows": "the renderer exposes glyphs without source text",
      },
      platform,
      unit: platform === "apple" ? ("pt" as const) : ("dp" as const),
    };

    const parsed = readCaptures({
      captures: [{ ...capture, measurements: [...capture.measurements] }],
    });

    assert.equal(parsed.kind, "captures");

    if (parsed.kind !== "captures") {
      throw new Error("invalid capture");
    }

    const [native] = parsed.file.captures;
    assert.ok(native);
    const findings = evaluateCapture(native);
    assert.equal(findings.filter((finding) => finding.level === "not-measured").length, 3);

    assert.ok(
      findings.some(
        (finding) =>
          finding.message === `line-end not measured on ${platform}` &&
          finding.detail.includes("glyphs without source text"),
      ),
    );

    assert.ok(
      findings.some(
        (finding) =>
          finding.message === `cut not measured on ${platform}` &&
          finding.detail.includes("clip boundaries"),
      ),
    );
  }
});

test("native version 2 control frames turn an unmeasured height rule into a measured failure", () => {
  for (const platform of ["apple", "android"] as const) {
    const native = {
      ...fixtureCapture([
        element({
          bounds: [0, 0, 80, 36],
          group: null,
          id: "back",
          part: "control",
          piece: "page",
          row: null,
          surface: "page",
          variant: "button",
        }),
        element({
          bounds: [88, 0, 80, 48],
          group: null,
          id: "next",
          part: "control",
          piece: "page",
          row: null,
          surface: "page",
          variant: "button",
        }),
      ]),
      platform,
    };

    const old = evaluateCapture({ ...native, measurements: undefined, version: 1 });

    assert.ok(
      old.some((finding) => finding.rule === "one-height" && finding.level === "not-measured"),
    );

    const current = evaluateCapture(native).filter((finding) => finding.rule === "one-height");
    assert.equal(current.length, 1);
    assert.equal(current[0]?.level, "fail");
    assert.equal(current[0]?.measured, 12);
  }
});
