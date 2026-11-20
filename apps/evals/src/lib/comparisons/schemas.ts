import z from "zod";

const text = z.string().min(1);
export const digest = z.string().regex(/^[a-f0-9]{64}$/u);
export const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u);
export const side = z.enum(["incumbent", "challenger"]);
const label = z.enum(["A", "B"]);
const preference = z.enum(["A", "B", "tie"]);
export const readerSchema = z.object({
  channel: z.enum(["seat", "gateway", "owner"]),
  family: z.enum(["anthropic", "openai", "google", "owner"]),
  model: text,
  reserve: z.boolean().optional(),
});
export type Reader = z.infer<typeof readerSchema>;
const criterionSchema = z.object({ expectations: text, id: text, label: text });
export const prioritiesSchema = z.object({
  comparison: z
    .object({
      criteria: z.record(text, z.enum(["disqualifies", "counts"])),
      preference: z.enum(["canBlock", "separates"]),
      trade: z
        .object({
          majorIncreasePer100: z.number().min(0).max(100),
          saveCostShare: z.number().min(0).max(1).nullable(),
          saveSeconds: z.number().nonnegative().nullable(),
        })
        .nullable(),
    })
    .optional(),
  distribution: z.enum(["shared", "private"]),
  first: z.enum(["quality", "cost", "latency"]),
  reads: text,
  reason: text,
  waits: text,
});
export type TaskPriorities = z.infer<typeof prioritiesSchema>;
export const observationSchema = z.object({
  claim: text,
  criterion: text,
  learnerCost: text,
  location: z.object({ detail: text, kind: z.enum(["quote", "range", "whole"]) }),
  output: label,
  severity: z.enum(["major", "minor"]),
});
const preferenceSchema = z.object({ preference, reason: text });
export const verdictSchema = z.object({
  criteria: z.array(preferenceSchema.extend({ criterion: text })),
  observations: z.array(observationSchema),
  overall: preferenceSchema.nullable(),
  pairId: text,
});
export const responseSchema = z.object({ verdicts: z.array(verdictSchema) });
const ownerVerdictSchema = verdictSchema.extend({
  criteria: z.array(preferenceSchema.extend({ criterion: text, reason: text.optional() })),
});
export const ownerResponseSchema = z.object({ verdicts: z.array(ownerVerdictSchema) });
export const verificationSchema = z.object({
  results: z.array(
    z.object({
      claimId: text,
      finding: z.enum(["holds", "holds for both", "doesn't hold", "unsure"]),
      reason: text,
    }),
  ),
});
const input = z.record(z.string(), z.unknown());
const firstLabel = "A";
const secondLabel = "B";
const imageOutput = z.object({ image: digest });
const packetOutput = z.union([text, imageOutput]);
export type PacketOutput = z.infer<typeof packetOutput>;

export function blindOutputs(first: PacketOutput, second: PacketOutput | null) {
  return { [firstLabel]: first, [secondLabel]: second };
}
const pairContent = z.object({
  expectations: text,
  [firstLabel]: packetOutput,
  input,
  [secondLabel]: packetOutput.nullable(),
});
export const packetSchema = z.object({
  criteria: z.array(criterionSchema),
  pairs: z.array(pairContent.extend({ pairId: text })),
  reads: text,
});
export type Packet = z.infer<typeof packetSchema>;
export const controlsSchema = z.object({
  pairs: z
    .array(
      z.object({
        clean: packetOutput,
        criterion: text,
        defect: text,
        expectations: text,
        falseAllegation: text,
        flawed: packetOutput,
        input,
        provenance: text,
      }),
    )
    .min(1),
});
export const variantSchema = z.object({
  model: text,
  pipeline: z.array(text),
  reasoning: text,
  settingsHash: digest,
  systemPromptHash: digest,
});
export type Variant = z.infer<typeof variantSchema>;
const slotSchema = z.object({
  costUsd: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  hash: digest,
  mediaType: z.literal("image/webp").optional(),
  userPromptHash: digest,
});

const selectionCase = z.object({ expectations: text, id: text, input, language: text });
export const selectionSchema = z.object({
  cases: z.array(selectionCase).min(1),
  controls: controlsSchema,
  criteria: z.array(criterionSchema),
  date: z.iso.datetime(),
  id: identifier,
  latencyBudget: z.object({ p50: z.number(), p95: z.number() }).nullable(),
  priorities: prioritiesSchema,
  protocols: z.object({ reader: text, verifier: text }),
  question: text,
  readers: z.array(readerSchema),
  runs: z.int().positive(),
  taskId: identifier,
  variants: z.object({ challenger: variantSchema, incumbent: variantSchema.nullable() }),
  version: z.literal(1),
});
export const runSchema = z.object({
  caseId: text,
  challenger: slotSchema.nullable(),
  failures: z.array(z.object({ costUsd: z.number().nonnegative(), reason: text, side })),
  incumbent: slotSchema.nullable(),
  run: z.int().positive(),
});
const mapping = z.object({
  caseId: text,
  clean: label.nullable(),
  criterion: text.nullable(),
  first: side,
  kind: z.enum(["real", "identical", "defect"]),
  pairId: text,
  run: z.int(),
});
export const sealedPacketSchema = z.object({
  id: digest,
  mapping: z.array(mapping),
  packet: packetSchema,
  reader: readerSchema,
  reverse: z.boolean(),
});
export const manifestSchema = selectionSchema.extend({
  packets: z.array(sealedPacketSchema),
  runsCompared: z.array(runSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type SealedPacket = z.infer<typeof sealedPacketSchema>;
const failureCode = z.enum(["failed_controls", "invalid_response", "missing_verdicts"]);
export type FailureCode = z.infer<typeof failureCode>;
export const attemptSchema = z.object({
  attempt: identifier,
  costUsd: z.number().nonnegative(),
  failureCodes: z.array(failureCode).optional(),
  failures: z.array(text),
  packetId: digest,
  passed: z.boolean(),
  protocolHash: digest,
  reader: readerSchema,
  recordedAt: z.iso.datetime().optional(),
  response: ownerResponseSchema,
});
export type Attempt = z.infer<typeof attemptSchema>;
export const adjudicationSchema = z.object({
  blind: z.literal(false),
  caseId: text,
  direction: z.enum(["incumbent", "challenger", "tie"]),
  reason: z.string().trim().min(1),
  recordedAt: z.iso.datetime().optional(),
});
export type Adjudication = z.infer<typeof adjudicationSchema>;
export const checkSchema = z.object({
  caseId: text,
  costUsd: z.number().nonnegative(),
  name: text,
  passed: z.int(),
  problems: z.array(text),
  run: z.int(),
  side,
  total: z.int(),
});
export const verificationAttemptSchema = z.object({
  claims: z.array(
    z.object({
      caseId: text,
      claimId: text,
      criterion: text,
      observationId: text,
      run: z.int(),
      side,
    }),
  ),
  costUsd: z.number().nonnegative(),
  id: digest,
  packet: text,
  passed: z.boolean(),
  protocolHash: digest,
  reader: readerSchema,
  response: verificationSchema,
});
export type Comparison = {
  adjudications: Adjudication[];
  manifest: Manifest;
  outputs: Record<string, string | Buffer>;
  attempts: Attempt[];
  checks: z.infer<typeof checkSchema>[];
  verifications: z.infer<typeof verificationAttemptSchema>[];
};
