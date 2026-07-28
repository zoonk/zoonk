import "server-only";
import { listCurrentUserContinueLearningItems } from "@zoonk/core/courses/list-current-user-continue-learning";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Keeps the optional home feed available during transient data failures. The
 * fallback stays outside the private cache so a failed read is never persisted
 * as a successful empty result.
 */
export async function getContinueLearning() {
  const { data } = await safeAsync(listCurrentUserContinueLearningItems);
  return data ?? [];
}
