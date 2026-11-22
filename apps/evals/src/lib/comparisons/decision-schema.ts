import z from "zod";
import { adjudicationSchema, replaySchema, side } from "./schemas";

const direction = z.enum(["incumbent", "challenger", "tie", "split", "unresolved"]);
export type Direction = z.infer<typeof direction>;
const caseRun = z.object({ caseId: z.string(), run: z.int().positive() });

const qualitySchema = z.object({
  affected: z.array(caseRun),
  both: z.array(caseRun),
  check: z.literal(true).optional(),
  criterion: z.string(),
  language: z.string(),
  ownerAffected: z.array(caseRun).optional(),
  weight: z.int().positive().nullable().optional(),
});

const deliverySchema = z.object({
  costPer1000: z.number().nullable(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  successful: z.int(),
});

const preferenceCounts = z.object({
  challenger: z.int().nonnegative(),
  incumbent: z.int().nonnegative(),
  tie: z.int().nonnegative(),
});

const preferenceBreakdown = z.object({
  families: z.array(preferenceCounts.extend({ family: z.string() })),
  lean: side.nullable(),
  total: preferenceCounts,
});

const preferenceRow = preferenceBreakdown.extend({
  byLanguage: z.array(preferenceBreakdown.extend({ language: z.string() })),
  criterion: z.string().nullable(),
  label: z.string(),
});

export const decisionSchema = z.object({
  cases: z.array(
    z.object({
      adjudication: adjudicationSchema.optional(),
      caseId: z.string(),
      language: z.string(),
      owner: direction.nullable(),
      result: direction,
      votes: z.record(z.string(), direction),
    }),
  ),
  outcome: z.enum(["switch", "retain", "neither qualifies", "insufficient evidence"]),
  preferences: z.array(preferenceRow),
  readers: z.array(
    z.object({
      failedPackets: z.int(),
      family: z.string(),
      model: z.string(),
      ownOpportunities: z.int(),
      ownWins: z.int(),
      ownerAgrees: z.int(),
      ownerCompared: z.int(),
    }),
  ),
  reason: z.string(),
  reasonCode: z.literal("owner_blind_read_required").optional(),
  replay: replaySchema.optional(),
  rows: z.array(
    z.object({
      attempted: z.int(),
      casesByLanguage: z.record(z.string(), z.int()),
      costPer1000: z.number().nullable(),
      date: z.string(),
      deliveryByLanguage: z.record(z.string(), deliverySchema),
      losses: z.int(),
      missingMatches: z.int(),
      p50: z.number().nullable(),
      p95: z.number().nullable(),
      quality: z.array(qualitySchema),
      side,
      status: z.enum(["eligible", "dominated", "trade", "disqualified"]),
      succeeded: z.int(),
      ties: z.int(),
      unresolved: z.int(),
      weightedMajorsByLanguage: z.record(z.string(), z.int()).optional(),
      wins: z.int(),
    }),
  ),
});
export type Decision = z.infer<typeof decisionSchema>;
