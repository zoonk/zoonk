/** One transcribed turn of a live call: the learner or the character the voice model plays. */
export type ConversationTurn = { speaker: "learner" | "character"; text: string };

/**
 * Numbers the turns and names each speaker the way the task's prompt does
 * ("EXAMINER" and "CANDIDATE" in a mock exam), so tasks that read a call
 * see the same transcript shape.
 */
export function formatConversationTranscript({
  labels,
  turns,
}: {
  labels: Record<ConversationTurn["speaker"], string>;
  turns: readonly ConversationTurn[];
}): string {
  return turns
    .map((turn, index) => `${index + 1}. ${labels[turn.speaker]}: ${turn.text}`)
    .join("\n");
}
