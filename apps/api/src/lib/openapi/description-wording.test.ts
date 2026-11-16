import { describe, expect, it } from "vitest";
import { openAPIDocument } from "./document";

const CLAUSE_START = String.raw`(?:^|[.:;,]\s+|—\s*|\(|\b(?:so|then|never|always|don't|do not|instead|otherwise|else|but|and|or)\s+)`;
const SENTENCE_START = String.raw`(?:[.:;]\s+|\(|\b(?:so|then|never|always|don't|do not|instead|otherwise|else|but)\s+)`;

/**
 * Common ways a description words a screen, never every way: reading it is still the rule.
 * "Name", "label", "word", "offer" and "lead" are also nouns ("Name of the exam", "its date and
 * name"), so they count only where a sentence starts or after "so", "never" and the like.
 */
const CLIENT_INSTRUCTIONS = [
  new RegExp(
    String.raw`${CLAUSE_START}(?:say|show|draw|mention|render|hide|ask the learner)\b(?![-'])`,
    "giu",
  ),
  new RegExp(String.raw`${SENTENCE_START}(?:name|label|word|offer|phrase|lead)\b(?![-'])`, "giu"),
  /\b(?:shown|displayed|rendered) as\b/giu,
  /\b(?:should|must) (?:appear|show|display|say|read)\b/giu,
  /\bkeep (?:it|them)\b[^.;]{0,40}\bhidden\b/giu,
  /(?:^|[.:;,(]\s*)(?:never|always) (?:shown|hidden|displayed)\b/giu,
];

function findClientInstructions(description: string) {
  return CLIENT_INSTRUCTIONS.flatMap((pattern) =>
    [...description.matchAll(pattern)].map((match) => match[0].trim()),
  );
}

function collectDescriptions(
  value: unknown,
  path: string,
): { description: string; path: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectDescriptions(item, `${path}/${index}`));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    key === "description" && typeof child === "string"
      ? [{ description: child, path }]
      : collectDescriptions(child, `${path}/${key}`),
  );
}

describe("contract descriptions", () => {
  it.each([
    "A plan whose date came with lessons left goes on once the learner moves its date, so say an `afterEnd` day is after their date, never that their plan ended",
    "How the questions split: the notice's counts, or evenly because it counts none (say so)",
    "The day's blocks that catch up: label them so",
    "Null when it asked them all. Never say it finished while challenges remain",
    "The plan doesn't end. Offer the change that keeps it going",
    "The mocks the learner started. Lead the exam's mocks with them",
    "The prior plan is preserved. Ask the learner to pick a later day.",
    "The plan is late, say so in its header",
    "The plan's date — show it beside the title",
    "A public document its facts come from, shown as a dated Sources chip",
    "It should appear under the lesson's title",
    "The score is displayed as a percentage",
    "The row must show its date",
    "Keep them locked and hidden until the plan is ready",
    "Identifies the subject in lists; never shown",
  ])("flags a description that tells a client what to say or show: %s", (description) => {
    expect(findClientInstructions(description)).not.toStrictEqual([]);
  });

  it.each([
    "An `afterEnd` day is after the goal's date; a plan whose date came with lessons left continues once the learner moves its date",
    "Whether past exam questions from the source may be quoted, with the terms that say so",
    "Names the numbers `effect` shows, and changes whenever they do",
    "The one milestone the learner hasn't been shown yet, until it's marked as shown",
    "Set while the offer was never shown",
    "Display name",
    "What learners call it, when that differs from `name`",
    "Opens the sitting `focusTest.offer` describes",
    "A language goal's noticed pattern or words to say again, from its Today view",
    "Name of the exam, as its notice writes it",
    "The exam's date and name",
    "The course's level or label",
    "Word the learner tapped",
    "Label for the area in the exam's own words",
    "Offer the learner can accept with one tap",
  ])("passes a description that says what a value means: %s", (description) => {
    expect(findClientInstructions(description)).toStrictEqual([]);
  });

  it("never tells a client what to say or show", () => {
    const descriptions = collectDescriptions(openAPIDocument, "");

    expect(descriptions.length).toBeGreaterThan(2000);

    expect(descriptions).toContainEqual({
      description: expect.stringContaining("An `afterEnd` day is after the goal's date"),
      path: "/components/schemas/StudyWeekDay/properties/kind",
    });

    const instructions = descriptions.flatMap(({ description, path }) =>
      findClientInstructions(description).map((match) => `${path}: ${match}`),
    );

    expect(instructions).toStrictEqual([]);
  });
});
