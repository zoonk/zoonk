import { type Goal } from "@zoonk/db";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseProfileAnswer } from "./profile-answer-normalization";
import { normalizeProfileFavorites, splitProfileFavorites } from "./profile-favorites";
import {
  PROFILE_QUESTIONS,
  getProfileSteps,
  profileAnswerInputSchema,
} from "./profile-question-contract";
import { toProfileFacts } from "./profile-statements";

const goal: Pick<Goal, "details" | "kind" | "language" | "planRevealedAt" | "replacesGoalId"> = {
  details: {},
  kind: "learn",
  language: "pt",
  planRevealedAt: null,
  replacesGoalId: null,
};

describe("profile steps", () => {
  it("keeps order, memory gates, answered versions and per-onboarding skips", () => {
    expect(getProfileSteps({ answered: {}, goal, memoryEnabled: true })).toStrictEqual(
      PROFILE_QUESTIONS,
    );

    expect(getProfileSteps({ answered: {}, goal, memoryEnabled: false })).toStrictEqual([
      "addressForm",
      "conditions",
      "learningSupport",
    ]);

    expect(
      getProfileSteps({
        answered: { watch: 0, work: 1 },
        goal: { ...goal, details: { answered: ["tools"] } },
        memoryEnabled: true,
      }),
    ).toStrictEqual(PROFILE_QUESTIONS.filter((id) => id !== "work" && id !== "tools"));
  });

  it.each(["de", "es", "fr", "it", "pl", "pt"])(
    "asks how to address the learner first when the app speaks %s",
    (language) => {
      expect(
        getProfileSteps({ answered: {}, goal: { ...goal, language }, memoryEnabled: true })[0],
      ).toBe("addressForm");
    },
  );

  it.each(["en", "ja", "ko", "tr"])(
    "leaves the address question to Settings when the app speaks %s",
    (language) => {
      expect(
        getProfileSteps({ answered: {}, goal: { ...goal, language }, memoryEnabled: true }),
      ).toStrictEqual(PROFILE_QUESTIONS.filter((question) => question !== "addressForm"));
    },
  );

  it.each([
    { kind: "explain" as const },
    { replacesGoalId: "previous" },
    { planRevealedAt: new Date() },
  ])("excludes goals past setup: %j", (overrides) => {
    expect(
      getProfileSteps({ answered: {}, goal: { ...goal, ...overrides }, memoryEnabled: true }),
    ).toStrictEqual([]);
  });
});

describe("profile statements", () => {
  it("preserves favorites order and deduplicates every supported separator", () => {
    expect(splitProfileFavorites(" Star Trek; Fringe、STAR TREK，Dragon Ball\n ")).toStrictEqual([
      "Star Trek",
      "Fringe",
      "Dragon Ball",
    ]);

    fc.assert(
      fc.property(fc.array(fc.string()), (items) => {
        const result = splitProfileFavorites(items.join(";"));
        expect(result.every((item) => item.length > 0 && item.trim() === item)).toBe(true);
        expect(new Set(result.map((item) => item.toLowerCase())).size).toBe(result.length);
        expect(splitProfileFavorites(result.join(";"))).toStrictEqual(result);
        const canonical = normalizeProfileFavorites(items.join(";"));
        expect(normalizeProfileFavorites(canonical)).toBe(canonical);

        const parsed = parseProfileAnswer({ answer: { favorites: canonical }, question: "watch" });
        expect(Boolean(parsed)).toBe(canonical.length > 0 && canonical.length <= 120);

        const source = items
          .join(";")
          .split(/[,;、，\r\n]/u)
          .map((item) => item.trim())
          .filter(Boolean);

        expect(result.map((item) => source.indexOf(item))).toStrictEqual(
          result.map((item) => source.indexOf(item)).toSorted((a, b) => a - b),
        );
      }),
    );
  });

  const examples = [
    { answer: { job: "software engineer", status: "work" }, question: "work" },
    { answer: { favorites: "Python", picks: ["figma"] }, question: "tools" },
    { answer: { studies: [{ field: "media", subject: "journalism" }] }, question: "studies" },
    { answer: { favorites: "Star Trek", picks: ["sciFi", "anime"] }, question: "watch" },
    { answer: { picks: ["rock"] }, question: "listen" },
    { answer: { picks: ["soccer"] }, question: "play" },
    { answer: { picks: ["newsPolitics"] }, question: "read" },
    { answer: { picks: ["cook", "travel"] }, question: "activities" },
    { answer: { note: "One idea at a time" }, question: "learningSupport" },
  ];

  it.each(examples)(
    "writes $question in English and Portuguese without overstating education",
    (raw) => {
      const input = profileAnswerInputSchema.parse(raw);

      for (const locale of ["en", "pt"] as const) {
        const facts = toProfileFacts({ ...input, locale });
        expect(facts.length).toBeGreaterThan(0);
        expect(facts.every((fact) => fact.statement.length > 0)).toBe(true);

        expect(
          facts.some((fact) => /\b(?:completed|degree|graduated)\b/iu.test(fact.statement)),
        ).toBe(false);
      }
    },
  );

  it("writes a precise founder statement and flags only typed text", () => {
    const input = profileAnswerInputSchema.parse(examples[3]);

    expect(toProfileFacts({ ...input, locale: "en" })[0]).toMatchObject({
      category: "context",
      sensitive: true,
      statement: "Watches sci-fi and fantasy and anime, especially Star Trek",
    });

    expect(
      toProfileFacts({ ...profileAnswerInputSchema.parse(examples[5]), locale: "en" })[0]
        ?.sensitive,
    ).toBe(false);

    expect(toProfileFacts({ ...input, locale: "pt" })[0]?.statement).toBe(
      "Assiste a ficção científica e fantasia e anime, principalmente Star Trek",
    );
  });

  it.each(PROFILE_QUESTIONS)(
    "accepts a complete decline for %s and writes no facts",
    (question) => {
      const input = parseProfileAnswer({ answer: { declined: true }, question });
      expect(input).not.toBeNull();

      if (!input) {
        throw new Error("Expected a valid decline");
      }

      expect(toProfileFacts({ ...input, locale: "en" })).toStrictEqual([]);
    },
  );

  it("limits the canonical favorites rather than the submitted separators", () => {
    const items = Array.from({ length: 13 }, (_, index) => `ドラゴンボール${index}`);
    expect(items.join("、").length).toBeLessThanOrEqual(120);
    expect(items.join(", ").length).toBeGreaterThan(120);

    expect(
      parseProfileAnswer({ answer: { favorites: items.join("、") }, question: "watch" }),
    ).toBeNull();

    const repeated = Array.from({ length: 20 }, () => "Star Trek").join("; ");

    expect(
      parseProfileAnswer({ answer: { favorites: repeated }, question: "watch" }),
    ).toMatchObject({ answer: { favorites: "Star Trek" } });
  });

  it.each([
    { answer: { job: "developer", status: "student" }, question: "work" },
    { answer: { studies: [{ field: "other" }] }, question: "studies" },
    { answer: { conditions: [{ condition: "other" }], consented: true }, question: "conditions" },
    { answer: { declined: true, favorites: "Star Trek" }, question: "watch" },
    { answer: { picks: ["notAnOption"] }, question: "watch" },
    { answer: {}, question: "addressForm" },
    { answer: { declined: true, form: "feminine" }, question: "addressForm" },
    { answer: { form: "elu" }, question: "addressForm" },
  ])("refuses invalid content: %j", (input) => expect(parseProfileAnswer(input)).toBeNull());
});
