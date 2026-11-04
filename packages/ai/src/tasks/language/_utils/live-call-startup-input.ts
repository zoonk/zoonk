export type LiveCallTurn = { speaker: "character" | "learner"; text: string };

/** OpenAI takes at most 128 startup messages of 8,192 tokens in all: https://developers.openai.com/api/docs/guides/live-conversations */
const MAX_ITEMS = 128;
const MAX_TOKENS = 8192;

/** A token is at least one UTF-8 byte, so bytes bound it; each message adds its own framing. */
const ITEM_TOKENS = 8;

const encoder = new TextEncoder();

function countTokens(text: string): number {
  return encoder.encode(text).length + ITEM_TOKENS;
}

function toItem(turn: LiveCallTurn) {
  return turn.speaker === "learner"
    ? { content: [{ text: turn.text, type: "input_text" as const }], role: "user" as const }
    : { content: [{ text: turn.text, type: "output_text" as const }], role: "assistant" as const };
}

/** The call so far as conversation, from its most recent turns that fit, then the greeting. */
export function getLiveCallStartupInput({
  greeting,
  turns,
}: {
  greeting: string;
  turns: readonly LiveCallTurn[];
}) {
  const tokens = turns.map((turn) => countTokens(turn.text));
  const budget = MAX_TOKENS - countTokens(greeting);

  const fits = (start: number) =>
    turns.length - start < MAX_ITEMS &&
    tokens.slice(start).reduce((total, count) => total + count, 0) <= budget;

  const start = turns.findIndex((_turn, index) => fits(index));
  const kept = start === -1 ? [] : turns.slice(start);

  return [
    ...kept.map((turn) => ({ ...toItem(turn), type: "message" as const })),
    {
      content: [{ text: greeting, type: "input_text" as const }],
      role: "developer" as const,
      type: "message" as const,
    },
  ];
}
