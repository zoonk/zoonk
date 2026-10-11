import { normalizeString } from "@zoonk/utils/string";
import { type RuleContext, type RuleViolation, type SharedContentSnapshot } from "./rule-context";

/** Rows a violation names at most. */
const MAX_NAMED = 20;

/** Shorter personal strings ("Ana", "SP") match too much to say anything. */
const MIN_PERSONAL_LENGTH = 4;

/** The shared rows of `before` that `after` lacks, and the ones whose version changed. */
function compareSnapshots(context: RuleContext) {
  const empty: SharedContentSnapshot = new Map();
  const { after, before } = context.sharedContent ?? { after: empty, before: empty };
  const keys = [...before.keys()];

  return {
    changed: keys.filter((key) => after.has(key) && after.get(key) !== before.get(key)),
    missing: keys.filter((key) => !after.has(key)),
  };
}

/**
 * R29. Deleting an account never removes shared content: every shared Library row there before
 * the deletion is there after it. Only the learner's own personal and private data goes.
 */
export function checkSharedContentKept(context: RuleContext): RuleViolation[] {
  if (context.event.kind !== "accountDeleted" || !context.sharedContent) {
    return [];
  }

  const { missing } = compareSnapshots(context);

  return missing.length > 0
    ? [
        {
          details: { missing: missing.slice(0, MAX_NAMED), missingCount: missing.length },
          message: "Deleting an account removed shared content.",
          rule: "R29",
        },
      ]
    : [];
}

/**
 * R30. Prompts that write shared content never carry the learner's own words or data: no input of
 * a shared task contains the goal as they typed it, their name, their free-text answers or their
 * memory (compared without case and accents).
 */
export function checkSharedPromptsImpersonal(context: RuleContext): RuleViolation[] {
  const personal = (context.learner?.personalTexts ?? [])
    .map((text) => normalizeString(text))
    .filter((text) => text.length >= MIN_PERSONAL_LENGTH);

  return (context.generations ?? [])
    .filter((generation) => generation.shared)
    .flatMap((generation) => {
      const input = normalizeString(generation.input);
      const leaked = personal.filter((text) => input.includes(text));

      return leaked.length > 0
        ? [
            {
              details: { leaked, task: generation.task },
              message: `The shared task ${generation.task} was sent the learner's own words.`,
              rule: "R30",
            },
          ]
        : [];
    });
}

/**
 * R31. A prompt change never rewrites shared content: after a step run on a new prompt version
 * (the simulator replays a learner whose content the Library holds), every shared row is there
 * with the version it had, and no shared content was generated again.
 */
export function checkNoRegeneration(context: RuleContext): RuleViolation[] {
  if (context.event.kind !== "promptChanged") {
    return [];
  }

  const { changed, missing } = compareSnapshots(context);
  const generated = (context.generations ?? []).filter((generation) => generation.shared);

  return [
    changed.length + missing.length > 0 && {
      changed: changed.slice(0, MAX_NAMED),
      missing: missing.slice(0, MAX_NAMED),
    },
    generated.length > 0 && { generated: generated.map((generation) => generation.task) },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details,
      message: "A prompt change rewrote or regenerated shared content.",
      rule: "R31",
    }));
}
