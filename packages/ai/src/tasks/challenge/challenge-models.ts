// Split Sol scored 8.99 vs single-call 8.85 with stronger decisions; the round-2 blind read tied
// 9-9. Terra and Kimi passed the split eval; Claude overstated conclusions despite correct arithmetic.
// On 3 cases x 2 runs (18 Nov 2026), GPT-6.2 Sol scored 9.04 to 6.1 Sol's 8.98 at $108/1k against
// $117/1k, with p95 142 s against 270 s; a blind Opus read preferred it 5 to 0 with a tie and found
// no wrong numbers in either. Gemini 4 Hydrogen scored 7.81 at $469/1k.
export const CHALLENGE_MODELS = {
  fallbackModels: ["openai/gpt-6.1-terra", "moonshotai/kimi-k3.1-pro"],
  model: "openai/gpt-6.2-sol",
} as const;
