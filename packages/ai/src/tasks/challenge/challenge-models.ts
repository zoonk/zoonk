// Split Sol scored 8.99 vs single-call 8.85 with stronger decisions; the round-2 blind read tied
// 9-9. Terra and Kimi passed the split eval; Claude overstated conclusions despite correct arithmetic.
// In apps/evals/eval-results/comparisons/challenge-case/replay-gpt-6-2-sol, cases with
// agreement across reader families favored 6.1 Sol 2 to 0; five were unresolved. 6.2 Sol
// ran faster (126 s vs 184 s at p50), but its 7% cost saving ($117 vs $126 per 1,000)
// falls below the 70% required for a quality trade.
// Gemini 4 Hydrogen scored 7.81 at $469 per 1,000.
export const CHALLENGE_MODELS = {
  fallbackModels: ["openai/gpt-6.1-terra", "moonshotai/kimi-k3.1-pro"],
  model: "openai/gpt-6.1-sol",
} as const;
