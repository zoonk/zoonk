import { z } from "zod";

type GatewayGenerationMetadata = {
  /** List price, reported even when our own key paid. */
  costUsd?: number;
  /** `byok` when our provider key paid for the call, `system` when the gateway's credits did. */
  credential?: string;
  servedModel?: string;
  servedProvider?: string;
  /** `flex` or `priority`; unset for the standard tier. */
  serviceTier?: string;
};

const jsonObjectSchema = z.record(z.string(), z.unknown());
const modelAttemptsSchema = z.array(z.unknown());

const successfulModelAttemptSchema = z.object({
  canonicalSlug: z.string(),
  providerAttempts: z
    .array(z.object({ credentialType: z.string().optional(), success: z.boolean().optional() }))
    .optional(),
  success: z.literal(true),
});

const servedTierSchema = z.enum(["flex", "priority"]);

/** AI Gateway reports cost as a decimal string ("0.0045405"); a number is accepted too. */
const usdSchema = z
  .union([z.number(), z.string().trim().min(1).transform(Number)])
  .pipe(z.number().nonnegative());

/**
 * Only the attempt that answered has `success: true`. Its `canonicalSlug` is the gateway model id;
 * `modelId` is the provider's internal id.
 */
function findServedAttempt(modelAttempts: readonly unknown[] = []) {
  return modelAttempts
    .map((attempt) => successfulModelAttemptSchema.safeParse(attempt).data)
    .findLast((attempt) => attempt !== undefined);
}

/**
 * `cost` is zero when our own provider key paid, so `marketCost`, the list price either way, is
 * preferred. `@ai-sdk/gateway` types this metadata as open JSON, so each field is parsed on its
 * own and a reshaped one never fails a generation that was already paid for.
 */
export function readGatewayMetadata(
  providerMetadata: Readonly<Record<string, unknown>> | undefined,
): GatewayGenerationMetadata {
  const gateway = jsonObjectSchema.safeParse(providerMetadata?.gateway).data;
  const routing = jsonObjectSchema.safeParse(gateway?.routing).data;
  const served = findServedAttempt(modelAttemptsSchema.safeParse(routing?.modelAttempts).data);

  return {
    costUsd:
      usdSchema.safeParse(gateway?.marketCost).data ?? usdSchema.safeParse(gateway?.cost).data,
    credential: served?.providerAttempts?.findLast((attempt) => attempt.success)?.credentialType,
    servedModel: served?.canonicalSlug,
    servedProvider: z.string().safeParse(routing?.finalProvider).data,
    serviceTier: servedTierSchema.safeParse(gateway?.serviceTier).data,
  };
}
