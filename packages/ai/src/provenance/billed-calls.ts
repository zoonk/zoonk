import { AsyncLocalStorage } from "node:async_hooks";
import { type LanguageModelMiddleware, type LanguageModelUsage } from "ai";
import { type GenerationStep, describeStep } from "./task-provenance";

type WrapGenerate = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type CallOptions = Parameters<WrapGenerate>[0];
type ProviderResult = Awaited<ReturnType<CallOptions["doGenerate"]>>;
type ProviderStream = Awaited<ReturnType<CallOptions["doStream"]>>["stream"];
type StreamPart = ProviderStream extends ReadableStream<infer Part> ? Part : never;

/** `extra` marks a call made for work around a task, such as an eval's simulated learner. */
export type BilledCall = ReturnType<typeof describeStep> & { extra: boolean };

/** Each list belongs to the innermost run or meter around the call, so a nested one keeps its own. */
type Listeners = { extra?: boolean; meter?: BilledCall[]; run?: GenerationStep[] };

const listeners = new AsyncLocalStorage<Listeners>();

function toLanguageModelUsage({ inputTokens, outputTokens }: ProviderResult["usage"]) {
  return {
    inputTokenDetails: {
      cacheReadTokens: inputTokens.cacheRead,
      cacheWriteTokens: inputTokens.cacheWrite,
      noCacheTokens: inputTokens.noCache,
    },
    inputTokens: inputTokens.total,
    outputTokenDetails: { reasoningTokens: outputTokens.reasoning, textTokens: outputTokens.text },
    outputTokens: outputTokens.total,
    totalTokens:
      inputTokens.total === undefined && outputTokens.total === undefined
        ? undefined
        : (inputTokens.total ?? 0) + (outputTokens.total ?? 0),
  } satisfies LanguageModelUsage;
}

function record({
  heard,
  model,
  providerMetadata,
  responseModelId,
  usage,
}: Pick<ProviderResult, "providerMetadata" | "usage"> & {
  heard: Listeners | undefined;
  model: CallOptions["model"];
  responseModelId: string | undefined;
}): void {
  const step: GenerationStep = {
    model: { modelId: model.modelId, provider: model.provider },
    providerMetadata,
    response: { modelId: responseModelId ?? model.modelId },
    usage: toLanguageModelUsage(usage),
  };

  heard?.run?.push(step);
  heard?.meter?.push({ ...describeStep(step), extra: heard.extra === true });
}

/**
 * A provider bills a call once it answers, even when the answer then fails its schema or the work
 * it belongs to throws, so each call is recorded as it ends. A stream is read later and maybe
 * elsewhere, so its listeners are the ones around the call that started it.
 */
export const billedCallMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate, model }) => {
    const heard = listeners.getStore();
    const result = await doGenerate();

    record({
      heard,
      model,
      providerMetadata: result.providerMetadata,
      responseModelId: result.response?.modelId,
      usage: result.usage,
    });

    return result;
  },
  wrapStream: async ({ doStream, model }) => {
    const heard = listeners.getStore();
    const result = await doStream();
    let responseModelId: string | undefined;

    const stream = result.stream.pipeThrough(
      new TransformStream<StreamPart, StreamPart>({
        transform(part, controller) {
          if (part.type === "response-metadata") {
            responseModelId = part.modelId ?? responseModelId;
          }

          if (part.type === "finish") {
            record({
              heard,
              model,
              providerMetadata: part.providerMetadata,
              responseModelId,
              usage: part.usage,
            });
          }

          controller.enqueue(part);
        },
      }),
    );

    return { ...result, stream };
  },
};

/** `steps` gets each call `work` makes, whether it resolves or throws. */
export function collectRunCalls<T>(steps: GenerationStep[], work: () => Promise<T>): Promise<T> {
  return listeners.run({ ...listeners.getStore(), run: steps }, work);
}

/** `calls` gets each call `work` makes, whether it resolves or throws. */
export function meterBilledCalls<T>(calls: BilledCall[], work: () => Promise<T>): Promise<T> {
  return listeners.run({ ...listeners.getStore(), meter: calls }, work);
}

/** The meter around `work` gets its calls marked `extra`. */
export function meterAsExtra<T>(work: () => Promise<T>): Promise<T> {
  return listeners.run({ ...listeners.getStore(), extra: true }, work);
}
