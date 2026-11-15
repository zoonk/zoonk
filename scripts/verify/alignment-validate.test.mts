import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { ELEMENT_PARTS } from "./alignment-capture.mts";
import CASES from "./alignment-cases.json" with { type: "json" };
import { PART_NAMES } from "./alignment-table.mts";
import { readCaptures } from "./alignment-validate.mts";

const repository = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(repository, path), "utf8");
}

/**
 * The quoted words each match's first group writes: `"part": v == "filled" ? "action" : "anchor"`
 * gives "action" and "anchor", not the word it compares.
 */
function quoted(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap((match) =>
    [...(match[1] ?? "").replaceAll(/[!=]= *"[^"]*"/gu, "").matchAll(/"(?<word>[a-z-]+)"/gu)].map(
      (word) => word.groups?.word ?? "",
    ),
  );
}

/** The part names each platform's capture can write, read from its own source. */
const WRITERS = {
  android: [
    ...quoted(
      /enum class Part\((?<body>[\s\S]*?)\n {4}\}/u.exec(
        source(
          "apps/android/core/designsystem/src/main/kotlin/com/zoonk/android/ui/components/LayoutParts.kt",
        ),
      )?.groups?.body ?? "",
      /\w+\((?<id>"[a-z-]+")\)/gu,
    ),
    ...quoted(
      source(
        "apps/android/core/designsystem/src/testFixtures/kotlin/com/zoonk/android/ui/testing/LayoutCapture.kt",
      ),
      /"part" to (?<value>[^,)]+)/gu,
    ),
  ],
  apple: [
    ...[
      ...(
        /enum LayoutPart: String \{(?<body>[\s\S]*?)\n\}/u.exec(
          source("apps/apple/Zoonk/DesignSystem/LayoutReport.swift"),
        )?.groups?.body ?? ""
      ).matchAll(/^\s*case (?<name>\w+)/gmu),
    ].map((match) => match.groups?.name ?? ""),
    ...quoted(
      source("apps/apple/Zoonk/Testing/LayoutCapture.swift"),
      /"part": (?<value>[^,\]]+)/gu,
    ),
  ],
  web: [
    ...PART_NAMES,
    ...quoted(source("scripts/verify/alignment-probe.mts"), /part: (?<value>"[a-z-]+")/gu),
  ],
};

describe("the validator reads what the probes write", () => {
  it("reads every recorded capture, the column read's fills included, and refuses the two made to be", () => {
    const refused = Object.entries(CASES).flatMap(([name, capture]) =>
      readCaptures(capture).kind === "captures" ? [] : [name],
    );

    assert.deepEqual(refused, ["round 2 invalid-unit", "round 3 bad-specimen"]);
  });

  it("reads every part name each platform's capture can write, from the writers' own sources", () => {
    const read = new Set<string>([...ELEMENT_PARTS, "unmeasured"]);

    const unread = Object.entries(WRITERS).flatMap(([platform, parts]) => {
      assert.ok(parts.length > 3, `no part names found in ${platform}'s sources`);

      return [...new Set(parts)]
        .filter((part) => !read.has(part))
        .map((part) => `${platform}: ${part}`);
    });

    assert.deepEqual(unread, []);
  });
});
