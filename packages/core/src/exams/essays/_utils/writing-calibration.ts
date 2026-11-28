import { z } from "zod";
import { writingRowKind } from "../writing-contract";
import data from "./writing-calibration-data.json";

const revisionSchema = z.object({ model: z.string().min(1), promptVersion: z.string().min(1) });

const weightedResidualSchema = z.object({
  share: z.number().min(0).max(1),
  weight: z.number().positive().max(1),
});

export const writingCalibrationSchema = z.object({
  grader: revisionSchema,
  keysRevision: z.hash("sha256"),
  rows: z.partialRecord(
    writingRowKind,
    z.object({
      residuals: z.object({
        over: z.array(weightedResidualSchema).readonly(),
        under: z.array(weightedResidualSchema).readonly(),
      }),
    }),
  ),
  writer: revisionSchema,
});

export type WritingGrader = z.infer<typeof revisionSchema>;
export type WeightedResidual = z.infer<typeof weightedResidualSchema>;
export type WritingCalibration = z.infer<typeof writingCalibrationSchema>;
export type RowCalibration = NonNullable<
  WritingCalibration["rows"][keyof WritingCalibration["rows"]]
>;

export const writingCalibration = writingCalibrationSchema.nullable().parse(data);

const LIKELY_LEVEL = 0.8;
const RANK_TOLERANCE = 1e-12;

export function getWritingMargin(residuals: readonly WeightedResidual[]): number | null {
  let cumulative = 0;

  for (const { share, weight } of residuals) {
    cumulative += weight;

    if (cumulative + RANK_TOLERANCE >= LIKELY_LEVEL) {
      return share;
    }
  }

  return null;
}
