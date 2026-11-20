import { logError } from "@zoonk/utils/logger";
import { StreamProviderError } from "ai";

/**
 * OpenAI sends a 503 "overloaded" event after a response stream has started, which neither the
 * SDK's `maxRetries` nor the gateway's fallback models cover, so the learner's answer ended empty.
 * A stream retry reruns only the step that failed. Words already streamed can repeat, and the saved
 * answer replaces them when it ends.
 */
const STREAM_RETRIES = 2;

/**
 * For an answer a learner waits for. A provider error's message and data can hold the prompt, so
 * only what failed is logged; a recovered 503 is logged too, so a burst of them shows.
 */
export function answerStreamOptions(task: string) {
  return {
    onError: ({ error }: { error: unknown }) => {
      const provider = StreamProviderError.isInstance(error) ? error : null;

      logError("[AI Answer Stream Error]", {
        code: provider?.code,
        isRetryable: provider?.isRetryable,
        name: error instanceof Error ? error.name : typeof error,
        statusCode: provider?.statusCode,
        task,
      });
    },
    streamRetries: STREAM_RETRIES,
  };
}
