import { describe, expect, it, test } from "vitest";
import { FORMATTING_MODULE, formattingViolations } from "./formatting-rules.mts";

const formats = [
  "DateFormatter()",
  "Foundation.DateFormatter.localizedString(from: date, dateStyle: .short, timeStyle: .short)",
  "date.formatted(.dateTime.month(.wide))",
  "date.formatted(\n .studyDay.day())",
  "Date.FormatStyle(date: .long)",
  "DateComponentsFormatter()",
  "date.formatted(.iso8601)",
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
