export const NO_AI_SPEND_MESSAGE = "Paid AI calls are disabled by ZOONK_NO_AI_SPEND.";

export function isAiSpendDisabled(): boolean {
  const value = process.env.ZOONK_NO_AI_SPEND?.trim();
  return Boolean(value && value !== "0");
}

export const blockAiSpendFetch: typeof fetch = async () => {
  throw new Error(NO_AI_SPEND_MESSAGE);
};
