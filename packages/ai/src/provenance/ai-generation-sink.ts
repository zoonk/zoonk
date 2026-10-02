import { safeAsync } from "@zoonk/utils/error";
import { isTestEnvironment } from "../_utils/is-test-environment";
import { type AiGenerationEvent } from "./ai-generation-event";

type AiGenerationSink = (event: AiGenerationEvent) => Promise<void>;

declare global {
  /**
   * Lives on `globalThis` for the same reason as `AI_SDK_DEFAULT_PROVIDER`:
   * Next.js bundles instrumentation, routes and workflow steps separately, so
   * a module variable set in `register()` isn't the one tasks would read.
   */
  var zoonkAiGenerationSink: AiGenerationSink | undefined;
}

/**
 * Lets each app decide where `$ai_generation` events go (PostHog in the API)
 * without this package depending on an analytics SDK. Apps that never register
 * one, like evals, send nothing.
 */
export function registerAiGenerationSink(sink: AiGenerationSink): void {
  globalThis.zoonkAiGenerationSink = sink;
}

/** Analytics never fails a generation that already finished, and tests never send events. */
export async function captureAiGeneration(event: AiGenerationEvent): Promise<void> {
  const sink = globalThis.zoonkAiGenerationSink;

  if (!sink || isTestEnvironment()) {
    return;
  }

  await safeAsync(() => sink(event));
}
