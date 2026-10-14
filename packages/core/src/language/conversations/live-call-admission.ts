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

const ADMIN_CONNECTIONS = 100;

export async function getLiveCallAdmission() {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  await io();
  const now = new Date();

  const [setting, unresolved, estimated, cleanupHealthy] = await Promise.all([
    prisma.liveCallSetting.findUnique({ where: { id: LIVE_CALL_SETTING_ID } }),
    prisma.liveCallConnection.findMany({
      orderBy: { deadlineAt: "asc" },
      take: ADMIN_CONNECTIONS,
      where: { state: { not: "closed" } },
    }),
    prisma.liveCallConnection.findMany({
      orderBy: { closedAt: "desc" },
      take: ADMIN_CONNECTIONS,
      where: { costConfidence: "estimated", state: "closed" },
    }),
    isLiveCallCleanupHealthy({ now, transaction: prisma }),
  ]);

  /**
   * Unresolved rows first, then the latest settled by estimate, which no provider confirmed. A
   * settlement landing between the two reads shows a row in both: its settled copy wins.
   */
  const settledIds = new Set(estimated.map(({ id }) => id));

  const connections = [...unresolved.filter(({ id }) => !settledIds.has(id)), ...estimated].slice(
    0,
    ADMIN_CONNECTIONS,
  );

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
