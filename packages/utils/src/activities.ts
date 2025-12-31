export const ACTIVITY_KINDS = [
  "background",
  "challenge",
  "examples",
  "explanation",
  "explanation_quiz",
  "grammar",
  "lesson_quiz",
  "listening",
  "logic",
  "mechanics",
  "pronunciation",
  "reading",
  "review",
  "story",
  "vocabulary",
] as const;

const ACTIVITY_KIND_SET: ReadonlySet<string> = new Set(ACTIVITY_KINDS);

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function isValidActivityKind(kind: unknown): kind is ActivityKind {
  return typeof kind === "string" && ACTIVITY_KIND_SET.has(kind);
}
