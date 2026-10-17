import { safeAsync } from "@zoonk/utils/error";
import { isTestEnvironment } from "../_utils/is-test-environment";
import { type AiGenerationContext } from "./ai-generation-event";
import { type TaskProvenance } from "./task-provenance";

/** One finished AI call, as every sink receives it. */
export type AiGeneration = {
  context?: AiGenerationContext;
  /** Extra analytics properties for this kind of call, such as an evaluation's answers. */
  properties?: Readonly<Record<string, boolean | number | string>>;
  provenance: TaskProvenance;
  /** Stable task name, matching the task's eval id. */
  task: string;
};

type AiGenerationSink = (generation: AiGeneration) => Promise<void> | void;

declare global {
  /**
   * Lives on `globalThis` for the same reason as `AI_SDK_DEFAULT_PROVIDER`:
   * Next.js bundles instrumentation, routes and workflow steps separately, so
   * a module variable set in `register()` isn't the one tasks would read.
   */
  var zoonkAiGenerationSinks: Map<string, AiGenerationSink> | undefined;
}

/**
 * Lets each app decide where finished AI calls go (PostHog, the database's AI call log) without
 * this package depending on an analytics SDK or the database. Sinks are kept by name, so
 * registering one again (a hot reload) replaces it. Apps that never register one, like evals,
 * send nothing.
 */
export function registerAiGenerationSink(name: string, sink: AiGenerationSink): void {
  globalThis.zoonkAiGenerationSinks ??= new Map();
  globalThis.zoonkAiGenerationSinks.set(name, sink);
}

/** A sink never fails a generation that already finished, and tests never send anything. */
export async function captureAiGeneration(generation: AiGeneration): Promise<void> {
  const sinks = globalThis.zoonkAiGenerationSinks;

  if (!sinks || isTestEnvironment()) {
    return;
  }

  await Promise.all([...sinks.values()].map((sink) => safeAsync(async () => sink(generation))));
}
