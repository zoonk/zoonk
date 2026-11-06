import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { CURRENT_STEPS } from "@zoonk/core/library/lessons/versions";
import { prisma } from "@zoonk/db";

export type StepProvenanceOption = { model: string; promptVersion: string; screens: number };

export const listStepProvenanceOptions = cacheAdminData(
  async (): Promise<StepProvenanceOption[]> => {
    const rows = await prisma.step.groupBy({
      _count: { id: true },
      by: ["model", "promptVersion"],
      orderBy: { _count: { id: "desc" } },
      where: CURRENT_STEPS,
    });

    return rows.map((row) => ({
      model: row.model,
      promptVersion: row.promptVersion,
      screens: row._count.id,
    }));
  },
);
