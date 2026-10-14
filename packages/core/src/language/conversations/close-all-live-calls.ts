import "server-only";
import { prisma } from "@zoonk/db";
import { getAdminAccess } from "../../users/get-admin-access";
import { LIVE_CALL_SETTING_ID } from "./_utils/live-call-policy";
import { closeLiveCallConnection } from "./close-live-call-connection";

const DEFAULT_BATCH_SIZE = 25;

export async function closeAllLiveCalls({ limit = DEFAULT_BATCH_SIZE }: { limit?: number } = {}) {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  await prisma.liveCallSetting.upsert({
    create: { id: LIVE_CALL_SETTING_ID },
    update: { admission: "off" },
    where: { id: LIVE_CALL_SETTING_ID },
  });

  const connections = await prisma.liveCallConnection.findMany({
    orderBy: [
      { lastCloseAt: { nulls: "first", sort: "asc" } },
      { deadlineAt: "asc" },
      { id: "asc" },
    ],
    take: Math.max(1, Math.min(100, limit)),
    where: { state: { not: "closed" } },
  });

  const outcomes = await Promise.all(
    connections.map((connection) =>
      closeLiveCallConnection({
        connectionId: connection.id,
        generation: connection.generation,
        reason: "admin",
      }),
    ),
  );

  const remaining = await prisma.liveCallConnection.count({ where: { state: { not: "closed" } } });

  return {
    attempted: connections.length,
    closed: outcomes.filter((outcome) => outcome.status === "closed").length,
    remaining,
    status: "ready" as const,
  };
}
