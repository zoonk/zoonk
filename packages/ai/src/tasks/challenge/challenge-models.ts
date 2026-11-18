// Split Sol scored 8.99 vs single-call 8.85 with stronger decisions; the round-2 blind read tied
// 9-9. Terra and Kimi passed the split eval; Claude overstated conclusions despite correct arithmetic.
// On 7 cases x 2 runs (18 Nov 2026), GPT-6.2 Sol scored 9.05 to 6.1 Sol's 8.99 at $117/1k against
// $126/1k and a p50 of 126 s against 184 s. Blind Opus reads of 10 pairs preferred it 7 to 2 with a
// tie; the judge flagged one 6.2 Sol A/B branch that a reader called a wording slip, and a reader
// found a logic error in 6.1 Sol's plot reading. Gemini 4 Hydrogen scored 7.81 at $469/1k.
export const CHALLENGE_MODELS = {
  fallbackModels: ["openai/gpt-6.1-terra", "moonshotai/kimi-k3.1-pro"],
  model: "openai/gpt-6.2-sol",
} as const;
