import { type SeedStep } from "../library/types";
import { type CourseLookup } from "./course-lookup";
import { type SeedAttempt, type SeedLearner } from "./types";

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function choiceValue(choice: unknown): unknown {
  return typeof choice === "object" && choice !== null && "id" in choice ? choice.id : choice;
}

function stepChoices({ content }: SeedStep): unknown[] {
  return [content.options, content.answers, content.distractors]
    .flatMap((choices) => (isList(choices) ? choices : []))
    .map((choice) => choiceValue(choice));
}

/**
 * A reference counts screens from the lesson's start, so a lesson that gains a screen moves every
 * later answer onto another screen, where it would still save. Throws unless the screen offers
 * what the learner picked.
 */
export function answeredStepId({
  attempt,
  learner,
  lookup,
}: {
  attempt: SeedAttempt;
  learner: SeedLearner;
  lookup: CourseLookup;
}): string | null {
  if (!attempt.step) {
    return null;
  }

  const { lesson, position } = attempt.step;
  const step = lookup.lesson(lesson).steps[position];
  const choices = step ? stepChoices(step) : [];
  const picked = Object.values(attempt.answer).flat();

  if (picked.length === 0 || !picked.every((value) => choices.includes(value))) {
    throw new Error(
      `Seed learner "${learner.key}" attempt "${attempt.key}": screen ${position} of lesson "${lesson}" (${step?.kind ?? "none"}) doesn't offer ${JSON.stringify(picked)}`,
    );
  }

  return lookup.step(lesson, position);
}
