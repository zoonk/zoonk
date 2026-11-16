import { describe, expect, it } from "vitest";
import { openAPIDocument } from "./document";

/**
 * A verb that words a screen, in the imperative a client is told to follow: at a clause's start
 * or right after "so", "never" and the like. "The notice says", "it shows" and "the terms that say
 * so" describe the value and pass.
 */
const CLIENT_INSTRUCTION =
  /(?:^|[.:;]\s+|\(|\b(?:so|then|never|always|don't|do not|instead|otherwise|else|but|and|or)\s+)(?:say|show|label|word|name|draw|mention|offer|phrase|render|hide)\b(?![-'])/giu;

function findClientInstructions(description: string) {
  return [...description.matchAll(CLIENT_INSTRUCTION)].map((match) => match[0].trim());
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
    "Offer the change that keeps it going",
  ])("flags a description that tells a client what to say or show: %s", (description) => {
    expect(findClientInstructions(description)).not.toStrictEqual([]);
  });

  it.each([
    "An `afterEnd` day is after the goal's date; a plan whose date came with lessons left continues once the learner moves its date",
    "Whether past exam questions from the source may be quoted, with the terms that say so",
    "Names the numbers `effect` shows, and changes whenever they do",
    "The one milestone the learner hasn't been shown yet, until it's marked as shown",
    "Display name",
    "What learners call it, when that differs from `name`",
    "Opens the sitting `focusTest.offer` describes",
    "A language goal's noticed pattern or words to say again, from its Today view",
  ])("passes a description that says what a value means: %s", (description) => {
    expect(findClientInstructions(description)).toStrictEqual([]);
  });

  it("never tells a client what to say or show", () => {
    const instructions = collectDescriptions(openAPIDocument, "").flatMap(({ description, path }) =>
      findClientInstructions(description).map((match) => `${path}: ${match}`),
    );

    expect(instructions).toStrictEqual([]);
  });
});
