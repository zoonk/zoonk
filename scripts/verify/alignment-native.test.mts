/* oxlint-disable no-magic-numbers -- The fixtures are native control measurements. */
import assert from "node:assert/strict";
import { test } from "vitest";
import { element, filledActions, fixtureCapture } from "./alignment-fixtures.mts";
import { alignmentLines, summaryLine } from "./alignment-summary.mts";
import { readCaptures } from "./alignment-validate.mts";
import { evaluateCapture, evaluateFile } from "./alignment.mts";
import APPLE from "./fixtures/apple-platform-limits.json" with { type: "json" };

test("Apple design gallery samples do not count as a learner page's actions", () => {
  const capture = {
    ...fixtureCapture(filledActions("page", 2)),
    platform: "apple" as const,
    scenario: "gallery-fields",
    screen: "fields",
    unit: "pt" as const,
  };

  assert.ok(!evaluateCapture(capture).some((finding) => finding.rule === "one-filled"));

  const page = { ...capture, scenario: "fields", screen: "/settings" };
  assert.ok(evaluateCapture(page).some((finding) => finding.rule === "one-filled"));
});

test("declared Apple limits are visible and do not fail, while old and incomplete captures fail", () => {
  const parsed = readCaptures(APPLE);
  assert.equal(parsed.kind, "captures");

  if (parsed.kind !== "captures") {
    throw new Error("invalid capture");
  }

  const [capture] = parsed.file.captures;
  assert.ok(capture);
  const { findings, summary } = evaluateFile({ captures: [capture] });
  assert.equal(summary.failed, false);
  assert.equal(summary.notMeasured, 0);

  assert.match(
    summaryLine(summary),
    /not measurable on apple: SwiftUI Text.Layout doesn't expose resolved strings/u,
  );

  assert.match(alignmentLines(findings).join("\n"), /not measurable on apple/u);
  assert.equal(evaluateFile({ captures: [{ ...capture, version: 1 }] }).summary.failed, true);

  const web = {
    ...fixtureCapture([]),
    measuredRules: ["one-height"] as const,
    platform: "web" as const,
    unit: "px" as const,
  };

  assert.equal(
    evaluateFile({ captures: [{ ...web, measuredRules: [...web.measuredRules] }] }).summary
      .notMeasured,
    3,
  );
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

    const old = evaluateCapture({ ...native, measuredRules: undefined, version: 1 });

    assert.ok(
      old.some((finding) => finding.rule === "one-height" && finding.level === "not-measured"),
    );

    const current = evaluateCapture(native).filter((finding) => finding.rule === "one-height");
    assert.equal(current.length, 1);
    assert.equal(current[0]?.level, "fail");
    assert.equal(current[0]?.measured, 12);
  }
});

test("a web text record missing its line strings still fails measured coverage", () => {
  const capture = {
    ...fixtureCapture([element({ group: null, id: "text", part: "text", piece: "page" })]),
    platform: "web" as const,
    unit: "px" as const,
  };

  const { summary } = evaluateFile({ captures: [capture] });
  assert.equal(summary.failed, true);
  assert.equal(summary.notMeasured, 2);
});

test("platform declarations require a reason and cannot also claim a rule was measured", () => {
  for (const notMeasurable of [{ cut: " " }, { unknown: "No API" }, { "one-height": "No API" }]) {
    assert.equal(readCaptures({ ...APPLE, notMeasurable }).kind, "invalid");
  }
});

test.each([
  {
    ...APPLE,
    measuredRules: [],
    notMeasurable: { ...APPLE.notMeasurable, "one-height": "Unavailable" },
    platform: "web",
    unit: "px",
  },
  { ...APPLE, measuredRules: [], notMeasurable: { "one-height": "Unavailable" } },
  { ...APPLE, platform: "android", unit: "dp" },
])(
  "$platform captures cannot waive page rules outside their platform's allowed limits",
  (capture) => {
    assert.equal(readCaptures(capture).kind, "invalid");
  },
);

test("a cleared Android element cannot waive missing line strings elsewhere", () => {
  const capture = fixtureCapture([
    element({
      group: null,
      id: "caption",
      part: "unmeasured",
      reason: "clearAndSetSemantics removes this node's layout",
    }),
    element({ group: null, id: "readable", part: "text", piece: "page", text: "Elsewhere" }),
  ]);

  const { summary } = evaluateFile({ captures: [capture] });
  assert.equal(summary.failed, true);
  assert.equal(summary.notMeasured, 2);
});
