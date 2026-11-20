import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";

const ASK_TIMEOUT_MS = 45_000;

export async function requestWithin<Answer>(
  request: () => Promise<Answer | null>,
): Promise<Answer | null> {
  const { data } = await safeAsync(() => settleWithin({ ms: ASK_TIMEOUT_MS, request }));
  return data?.status === "settled" ? data.value : null;
}
