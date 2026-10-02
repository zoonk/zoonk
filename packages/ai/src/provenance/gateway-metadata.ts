import { z } from "zod";

type GatewayGenerationMetadata = {
  costUsd?: number;
  servedModel?: string;
  servedProvider?: string;
};

const jsonObjectSchema = z.record(z.string(), z.unknown());
const modelAttemptsSchema = z.array(z.unknown());

const successfulModelAttemptSchema = z.object({
  canonicalSlug: z.string(),
  success: z.literal(true),
});

/** AI Gateway reports cost as a decimal string ("0.0045405"); a number is accepted too. */
const usdSchema = z
  .union([z.number(), z.string().trim().min(1).transform(Number)])
  .pipe(z.number().nonnegative());

/**
 * With model fallbacks, `routing.modelAttempts` lists every model tried in
 * order and only the one that answered has `success: true`. Its
 * `canonicalSlug` is the gateway model id (`creator/model`); `modelId` is the
 * provider's internal id, so it isn't used.
 */
function findServedModel(modelAttempts: readonly unknown[] = []): string | undefined {
  return modelAttempts
    .map((attempt) => successfulModelAttemptSchema.safeParse(attempt).data)
    .findLast((attempt) => attempt !== undefined)?.canonicalSlug;
}

/**
 * Reads what AI Gateway says about one model call: the model and provider that
 * served it and its inference cost in USD, for text and image calls alike.
 * `@ai-sdk/gateway` types this metadata as open JSON, so each field is parsed
 * on its own: a missing or reshaped field leaves provenance on its SDK
 * fallback instead of failing a generation that already finished and was paid
 * for.
 */
export function readGatewayMetadata(
  providerMetadata: Readonly<Record<string, unknown>> | undefined,
): GatewayGenerationMetadata {
  const gateway = jsonObjectSchema.safeParse(providerMetadata?.gateway).data;
  const routing = jsonObjectSchema.safeParse(gateway?.routing).data;

  return {
    costUsd: usdSchema.safeParse(gateway?.cost).data,
    servedModel: findServedModel(modelAttemptsSchema.safeParse(routing?.modelAttempts).data),
    servedProvider: z.string().safeParse(routing?.finalProvider).data,
  };
}
