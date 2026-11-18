// Split Sol scored 8.99 vs single-call 8.85 with stronger decisions; the round-2 blind read tied
// 9-9. Terra and Kimi passed the split eval; Claude overstated conclusions despite correct arithmetic.
// On all 7 cases (18 Nov 2026), GPT-6.2 Sol scored 9.06 to 6.1 Sol's 8.95 at about $115/1k against
// $127/1k and a p50 of 115 s against 173 s; blind Opus reads preferred it 7 to 2 with a tie, and
// the readers found a logic error only in 6.1 Sol. Gemini 4 Hydrogen scored 7.81 at $469/1k.
export const CHALLENGE_MODELS = {
  fallbackModels: ["openai/gpt-6.1-terra", "moonshotai/kimi-k3.1-pro"],
  model: "openai/gpt-6.2-sol",
} as const;
