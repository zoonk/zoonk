// Split Sol scored 8.99 vs single-call 8.85 with stronger decisions; the round-2 blind read tied
// 9-9. Terra and Kimi passed the split eval; Claude overstated conclusions despite correct arithmetic.
export const CHALLENGE_MODELS = {
  fallbackModels: ["openai/gpt-6.1-terra", "moonshotai/kimi-k3.1-pro"],
  model: "openai/gpt-6.1-sol",
} as const;
