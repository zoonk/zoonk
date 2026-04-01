import { describe, expect, test } from "vitest";
import { getActivitiesForKind } from "./get-activities-for-kind";

describe(getActivitiesForKind, () => {
  describe("core lessons", () => {
    test("returns fallback explanation when concepts are empty", () => {
      const result = getActivitiesForKind("core", [], null, []);

      expect(result.map((a) => a.kind)).toEqual(["explanation", "practice", "quiz", "review"]);
      expect(result[0]?.title).toBeNull();
    });

    test("returns one explanation per concept with single practice for 1-3 concepts", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C"]);

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "review",
      ]);
      expect(result.map((a) => a.title)).toEqual(["A", "B", "C", null, null, null]);
    });

    test("inserts two practices when there are 4 concepts", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C", "D"]);

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "practice",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "review",
      ]);
    });

    test("splits 5 concepts into groups of 2 and 3", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C", "D", "E"]);

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "practice",
        "explanation",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "review",
      ]);
      expect(result[0]?.title).toBe("A");
      expect(result[1]?.title).toBe("B");
      expect(result[3]?.title).toBe("C");
      expect(result[4]?.title).toBe("D");
      expect(result[5]?.title).toBe("E");
    });

    test("returns single concept with single practice", () => {
      const result = getActivitiesForKind("core", [], null, ["Solo"]);

      expect(result.map((a) => a.kind)).toEqual(["explanation", "practice", "quiz", "review"]);
      expect(result[0]?.title).toBe("Solo");
    });
  });

  describe("language lessons", () => {
    test("includes listening for TTS-supported language", () => {
      const result = getActivitiesForKind("language", [], "en", []);

      expect(result.map((a) => a.kind)).toEqual([
        "vocabulary",
        "translation",
        "grammar",
        "reading",
        "listening",
        "review",
      ]);
      expect(result.every((a) => a.title === null)).toBe(true);
    });

    test("excludes listening for non-TTS language", () => {
      const result = getActivitiesForKind("language", [], "xx-unsupported", []);

      expect(result.map((a) => a.kind)).not.toContain("listening");
      expect(result.map((a) => a.kind)).toEqual([
        "vocabulary",
        "translation",
        "grammar",
        "reading",
        "review",
      ]);
    });

    test("excludes listening when targetLanguage is null", () => {
      const result = getActivitiesForKind("language", [], null, []);

      expect(result.map((a) => a.kind)).not.toContain("listening");
    });
  });

  describe("applied activity", () => {
    test("inserts story after quiz before review with 3 concepts", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C"], "story");

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "story",
        "review",
      ]);
    });

    test("inserts story after quiz before review with 5 concepts", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C", "D", "E"], "story");

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "practice",
        "explanation",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "story",
        "review",
      ]);
    });

    test("inserts story with 0 concepts", () => {
      const result = getActivitiesForKind("core", [], null, [], "story");

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "practice",
        "quiz",
        "story",
        "review",
      ]);
    });

    test("inserts story with 1 concept", () => {
      const result = getActivitiesForKind("core", [], null, ["Solo"], "story");

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "practice",
        "quiz",
        "story",
        "review",
      ]);
    });

    test("does not insert story when appliedActivityKind is null", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C"], null);

      expect(result.map((a) => a.kind)).toEqual([
        "explanation",
        "explanation",
        "explanation",
        "practice",
        "quiz",
        "review",
      ]);
    });

    test("defaults to no applied activity when parameter is omitted", () => {
      const result = getActivitiesForKind("core", [], null, ["A", "B", "C"]);

      expect(result.map((a) => a.kind)).not.toContain("story");
    });
  });

  describe("custom lessons", () => {
    test("returns custom activities from AI-generated definitions", () => {
      const customActivities = [
        { description: "Desc 1", title: "Custom 1" },
        { description: "Desc 2", title: "Custom 2" },
      ];

      const result = getActivitiesForKind("custom", customActivities, null, []);

      expect(result).toEqual([
        { description: "Desc 1", kind: "custom", title: "Custom 1" },
        { description: "Desc 2", kind: "custom", title: "Custom 2" },
      ]);
    });
  });
});
