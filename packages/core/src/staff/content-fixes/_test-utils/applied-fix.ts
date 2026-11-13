import { type ContentFixUnit, prisma } from "@zoonk/db";
import { type Json } from "../_utils/resolved-change";

/** A fix approval already applied, for code that reacts to what fixes changed. */
export function appliedFixFixture({
  changes,
  decidedAt = new Date(),
  unit = "lesson",
  unitId,
}: {
  changes: Json[];
  decidedAt?: Date;
  unit?: ContentFixUnit;
  unitId: string;
}) {
  return prisma.contentFix.create({
    data: {
      changes,
      decidedAt,
      effects: [],
      proposerClientId: "test",
      reason: "Test fix",
      status: "applied",
      unit,
      unitId,
    },
  });
}
