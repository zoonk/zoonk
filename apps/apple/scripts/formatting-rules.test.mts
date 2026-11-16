import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, test } from "vitest";
import { FORMATTING_MODULE, formattingViolations } from "./formatting-rules.mts";

const formats = [
  "DateFormatter()",
  "Foundation.DateFormatter.localizedString(from: date, dateStyle: .short, timeStyle: .short)",
  "date.formatted(.dateTime.month(.wide))",
  "date.formatted(\n .studyDay.day())",
  "Date.FormatStyle(date: .long)",
  "DateComponentsFormatter()",
  "Duration.UnitsFormatStyle()",
  "RelativeDateTimeFormatter()",
  "MeasurementFormatter()",
  "duration.formatted(.units(allowed: [.minutes]))",
  "duration.formatted(.time(pattern: .minuteSecond))",
  "date.formatted(date: .abbreviated, time: .omitted)",
];

describe("centralized native formatting", () => {
  it.each(formats)("reports %s outside the module", (source) => {
    expect(
      formattingViolations(`import Foundation\n${source}`, "Features/Screen.swift"),
    ).toStrictEqual([expect.objectContaining({ file: "Features/Screen.swift", line: 2 })]);
  });

  it.each(formats)("allows %s inside the module", (source) => {
    expect(formattingViolations(source, FORMATTING_MODULE)).toStrictEqual([]);
  });

  it("allows shared helpers, unrelated format styles, parsing and comments", () => {
    expect(
      formattingViolations(
        `
// DateFormatter()
/* date.formatted(.dateTime) */
PlanDate.longDay(day, today: today)
value.formatted(.percent)
names.formatted(.list(type: .and))
Date(iso8601String: wire)
`,
        "Features/Screen.swift",
      ),
    ).toStrictEqual([]);
  });

  it("does not exempt another file with the module's basename", () => {
    expect(formattingViolations("DateFormatter()", "Other/PlanModels.swift")).toHaveLength(1);
  });
});

test("ignores literal examples while checking Swift interpolations and preserving line numbers", () => {
  const source = String.raw`let label = "DateFormatter()"
let raw = #"date.formatted(.dateTime)"#
let text = "Day: \(date.formatted(.dateTime.month(.wide)))"
/* outer /* DateFormatter() */ still a comment */
`;

  expect(formattingViolations(source, "Screen.swift")).toStrictEqual([
    expect.objectContaining({ line: 3 }),
  ]);
});

const missedFormats = [
  "Text(date, style: .date)",
  "Text(date, format: .dateTime.month(.wide))",
  String.raw`Text("\(duration, format: .units(allowed: [.minutes]))")`,
  'String(format: "%02d:%02d", minutes, seconds)',
  'String(format: "%d min", minutes)',
  "calendar.weekdaySymbols",
  "DateIntervalFormatter()",
  "range.formatted(.interval.day())",
  "duration.formatted(.components(style: .abbreviated))",
  "Text(timerInterval: start...end, countsDown: true)",
];

describe("review regression fixtures", () => {
  it.each(missedFormats)("reports the missed form %s", (source) => {
    expect(formattingViolations(source, "Screen.swift")).toHaveLength(1);
    expect(formattingViolations(source, FORMATTING_MODULE)).toHaveLength(0);
  });
});

test("Apple CI runs the formatting gate with Node installed", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/apple.yml", import.meta.url),
    "utf8",
  );

  const formatJob = workflow.split("  format:")[1]?.split("  build:")[0] ?? "";
  expect(formatJob).toContain("make -C apps/apple format-check formatting-check");
  expect(formatJob.indexOf("actions/setup-node@")).toBeGreaterThan(-1);

  expect(formatJob.indexOf("actions/setup-node@")).toBeLessThan(
    formatJob.indexOf("format-check formatting-check"),
  );
});

test("the CLI reports warnings but fails for errors and allows the shared module", () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "native-formatting-"));

  try {
    mkdirSync(path.join(temporary, "scripts"));
    mkdirSync(path.join(temporary, "Zoonk/Features/Plan"), { recursive: true });
    const checker = path.join(temporary, "scripts/check-formatting.mts");
    const rules = path.join(temporary, "scripts/formatting-rules.mts");
    const source = readFileSync(new URL("formatting-rules.mts", import.meta.url), "utf8");
    writeFileSync(checker, readFileSync(new URL("check-formatting.mts", import.meta.url)));
    writeFileSync(rules, source);
    writeFileSync(path.join(temporary, "Zoonk/Screen.swift"), "DateFormatter()");
    expect(spawnSync(process.execPath, [checker]).status).toBe(0);
    writeFileSync(rules, source.replace('= "warning";', '= "error";'));
    expect(spawnSync(process.execPath, [checker]).status).toBe(1);
    rmSync(path.join(temporary, "Zoonk/Screen.swift"));
    writeFileSync(path.join(temporary, "Zoonk", FORMATTING_MODULE), "DateFormatter()");
    expect(spawnSync(process.execPath, [checker]).status).toBe(0);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});

const wireAndUntypedForms = [
  'String(format: "%04d-%02d-%02d", year, month, day)',
  'String(format: "%04d-%02d-01", year, month)',

  "count.formatted()",
  "3.formatted()",
  "date.formatted()",
  "Duration.seconds(30).formatted()",
  "date.formatted(.iso8601)",
  "Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day().parse(day)",
  "Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true))",
  "ISO8601DateFormatter().date(from: wire)",
  "ISO8601DateFormatter().string(from: date)",
];

describe("round two scope regressions", () => {
  it.each(wireAndUntypedForms)("allows wire or untyped form %s", (source) => {
    expect(formattingViolations(source, "Screen.swift")).toHaveLength(0);
  });

  it.each([
    'String(format: "%02d–%02d", start, end)',
    'String(format: "%02d-%02d", start, end)',
    "TimeZone(identifier: id)?.localizedName(for: .generic, locale: .current)",
  ])("reports the shown range or zone on its call line: %s", (source) => {
    expect(
      formattingViolations(`func shown() -> String {\n  ${source}\n}`, "Screen.swift"),
    ).toStrictEqual([expect.objectContaining({ line: 2 })]);

    expect(formattingViolations(source, FORMATTING_MODULE)).toHaveLength(0);
  });

  it("reports a typed date rendering rather than its parameter declaration", () => {
    const source = `private func completedOnText(_ style: Date.FormatStyle) -> String {
  studyDate(completedOn)?.formatted(style) ?? completedOn
}
func number(_ style: FloatingPointFormatStyle<Double>) -> String {
  value.formatted(style)
}`;

    expect(formattingViolations(source, "Screen.swift")).toStrictEqual([
      expect.objectContaining({ call: ".formatted(style)", line: 2 }),
    ]);
  });

  it("keeps the shared studyDay style definition and wire clock reported", () => {
    const source = `extension FormatStyle where Self == Date.FormatStyle {
  static var studyDay: Date.FormatStyle {
    var style = Date.FormatStyle(timeZone: .gmt)
  }
}
return String(format: "%02d:%02d", minutes / 60, minutes % 60)`;

    const expectedSites = 4;
    expect(formattingViolations(source, "Screen.swift")).toHaveLength(expectedSites);
  });
});
