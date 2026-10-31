import { type PrismaClient } from "../../generated/prisma/client";

export async function seedLiveCalls(prisma: PrismaClient): Promise<void> {
  const data = { admission: "all" as const, freeDailyBudgetMicros: 150_000_000 };

  await prisma.liveCallSetting.upsert({
    create: { id: "live", ...data },
    update: data,
    where: { id: "live" },
  });
}
