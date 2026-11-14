/** A part of a level test bank that a content fix names, so a test under way can tell what changed. */
export function levelTestPart(
  part: { kind: "question"; questionId: string } | { kind: "speaking"; level: string },
): string {
  return part.kind === "question" ? `question:${part.questionId}` : `speaking:${part.level}`;
}
