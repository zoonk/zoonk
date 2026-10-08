import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export type StepProvenanceOption = { model: string; promptVersion: string; screens: number };

/**
 * Every model and prompt version that wrote Library screens, with how many screens each wrote,
 * for the `/lessons` filters. Most used first, so the current writer is at the top.
 */
export const listStepProvenanceOptions = cacheAdminData(
  async (): Promise<StepProvenanceOption[]> => {
    const rows = await prisma.step.groupBy({
      _count: { id: true },
      by: ["model", "promptVersion"],
      orderBy: { _count: { id: "desc" } },
      where: { retiredAt: null },
    });

    return rows.map((row) => ({
      model: row.model,
      promptVersion: row.promptVersion,
      screens: row._count.id,
    }));
  },
);
