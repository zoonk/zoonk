export const NO_AI_SPEND_MESSAGE = "Paid AI calls are disabled by ZOONK_NO_AI_SPEND.";

export function isAiSpendDisabled(): boolean {
  return process.env.ZOONK_NO_AI_SPEND === "1";
}

export const blockAiSpendFetch: typeof fetch = async () => {
  throw new Error(NO_AI_SPEND_MESSAGE);
};
