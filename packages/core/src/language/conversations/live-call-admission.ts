import "server-only";
import { isLiveCallAvailable } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import { getAdminAccess } from "../../users/get-admin-access";
import {
  LIVE_CALL_SETTING_ID,
  getLiveCallAdminHealth,
  isLiveCallCleanupHealthy,
} from "./_utils/live-call-policy";
import {
  type LiveCallAdmissionInput,
  liveCallAdmissionInputSchema,
} from "./live-call-admission-contract";

export async function getLiveCallAdmission() {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  await io();
  const now = new Date();

  const [setting, connections, cleanupHealthy] = await Promise.all([
    prisma.liveCallSetting.findUnique({ where: { id: LIVE_CALL_SETTING_ID } }),
    prisma.liveCallConnection.findMany({
      orderBy: { deadlineAt: "asc" },
      take: 100,
      where: { state: { not: "closed" } },
    }),
    isLiveCallCleanupHealthy({ now, transaction: prisma }),
  ]);

  return {
    cleanupHealthy,
    connections: connections.map((connection) => ({
      ...connection,
      ...getLiveCallAdminHealth({ connection, now }),
    })),
    providerAvailable: isLiveCallAvailable(),
    setting: {
      admission: setting?.admission ?? "off",
      freeDailyBudgetMicros: setting?.freeDailyBudgetMicros ?? 0,
    },
    status: "ready" as const,
  };
}

export async function updateLiveCallAdmission(input: LiveCallAdmissionInput) {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const parsed = liveCallAdmissionInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const setting = await prisma.liveCallSetting.upsert({
    create: { ...parsed.data, id: LIVE_CALL_SETTING_ID },
    update: parsed.data,
    where: { id: LIVE_CALL_SETTING_ID },
  });

  return { setting, status: "ready" as const };
}
