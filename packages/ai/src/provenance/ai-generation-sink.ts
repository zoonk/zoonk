import { safeAsync } from "@zoonk/utils/error";
import { isTestEnvironment } from "../_utils/is-test-environment";
import { type AiGenerationContext } from "./ai-generation-event";
import { type TaskProvenance } from "./task-provenance";

export type AiGeneration = {
  context?: AiGenerationContext;
  properties?: Readonly<Record<string, boolean | number | string>>;
  provenance: TaskProvenance;
  /** Matches the task's eval id. */
  task: string;
};

type AiGenerationSink = (generation: AiGeneration) => Promise<void> | void;

declare global {
  /**
   * Next.js bundles instrumentation, routes and workflow steps separately, so a module variable set
   * in `register()` isn't the one tasks would read.
   */
  var zoonkAiGenerationSinks: Map<string, AiGenerationSink> | undefined;
}

/** Sinks are kept by name, so registering one again (a hot reload) replaces it. */
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
