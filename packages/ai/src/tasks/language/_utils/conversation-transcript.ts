export type ConversationTurn = { speaker: "learner" | "character"; text: string };

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
