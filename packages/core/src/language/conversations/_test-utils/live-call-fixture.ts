import { randomUUID } from "node:crypto";
import { type LanguageConversation, type LiveCallConnection, prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { onTestFinished, vi } from "vitest";
import { getSession } from "../../../users/get-session";

/** Minimal owned call: no generated scenario, plan, or provider work is needed to reserve it. */
export async function liveCallFixture({
  kind = "practice",
  minutes = 2,
  plus = false,
  role = "user",
}: {
  kind?: LanguageConversation["kind"];
  minutes?: number;
  plus?: boolean;
  role?: "user" | "admin";
} = {}) {
  const user = await userFixture({ role });
  const conversation = await anotherLiveConversation({ kind, minutes, userId: user.id });

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  /** Unresolved test calls must not trip the global cleanup-health guard in later cases. */
  onTestFinished(async () => {
    await prisma.liveCallSlot.deleteMany({ where: { userId: user.id } });
    await prisma.liveCallConnection.deleteMany({ where: { userId: user.id } });
  });

  return { conversation, user };
}

export function anotherLiveConversation({
  kind = "practice",
  minutes = 2,
  userId,
}: {
  kind?: LanguageConversation["kind"];
  minutes?: number;
  userId: string;
}) {
  return prisma.languageConversation.create({
    data: {
      kind,
      language: "pt",
      level: kind === "examSpeaking" ? "B2" : "A2",
      minutes,
      scenario:
        kind === "examSpeaking"
          ? {
              ...RENTING_SCENARIO,
              examTask: {
                card: {
                  instructions: ["Compare las propuestas."],
                  photos: [],
                  prompts: ["Alquilar una habitación", "Compartir un piso"],
                  summary: "Compare the renting proposals.",
                  table: null,
                  text: null,
                },
                exam: "dele",
                level: "B2",
                task: "t1",
              },
            }
          : RENTING_SCENARIO,
      targetLanguage: kind === "examSpeaking" ? "es" : "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId,
    },
  });
}

async function historyUsageId({
  conversationId,
  usageRecordId,
  userId,
}: Pick<LiveCallConnection, "conversationId" | "userId"> & {
  usageRecordId?: string;
}): Promise<string> {
  if (usageRecordId) {
    return usageRecordId;
  }

  const usage = await prisma.usageRecord.upsert({
    create: { kind: "conversation", targetId: conversationId, userId },
    update: {},
    where: { userUsageTarget: { kind: "conversation", targetId: conversationId, userId } },
  });

  return usage.id;
}

/** A persisted earlier connection, for admission limits without spending at the provider. */
export async function liveCallHistoryFixture({
  conversationId,
  usageRecordId,
  userId,
  ...attrs
}: Partial<LiveCallConnection> & Pick<LiveCallConnection, "conversationId" | "userId">) {
  const usageId = await historyUsageId({ conversationId, usageRecordId, userId });

  return prisma.liveCallConnection.create({
    data: {
      attemptNumber: 1,
      closedAt: new Date(),
      conversationId,
      costConfidence: "confirmed",
      createdAt: new Date(),
      deadlineAt: new Date(),
      generation: 1,
      heldSeconds: 0,
      liabilityMicros: 0,
      requestId: randomUUID(),
      reservedMicros: 0,
      state: "closed",
      usageRecordId: usageId,
      userId,
      ...attrs,
    },
  });
}

/** Uses the existing authenticated-request harness with the test-owned admin's database role. */
export function mockLiveCallAdminSession(user: { id: string; role: string | null }): void {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The existing core auth boundary reads identity and role; the fixture avoids duplicating Better Auth's session internals.
    { user: { id: user.id, role: user.role } } as Awaited<ReturnType<typeof getSession>>,
  );
}

/** PostgreSQL sequence increments survive rollback, so only this connection's first N receipts fail. */
export async function failLiveCallReceiptWrites({
  connectionId,
  failures,
}: {
  connectionId: string;
  failures: number;
}) {
  if (
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u.test(connectionId) ||
    !Number.isSafeInteger(failures) ||
    failures < 1
  ) {
    throw new Error("A receipt fault requires a fixture UUID and a positive failure count");
  }

  const suffix = randomUUID().replaceAll("-", "");
  const sequence = `live_receipt_seq_${suffix}`;
  const fault = `live_receipt_fn_${suffix}`;
  const trigger = `live_receipt_trigger_${suffix}`;
  /** Names contain only a fixed prefix and UUID hex; DDL cannot bind identifiers as query values. */
  async function restore(): Promise<void> {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON live_call_connections`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fault}()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${sequence}`);
  }

  onTestFinished(restore);
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE ${sequence}`);

  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $receipt$
    BEGIN
      IF NEW.id = '${connectionId}'::uuid AND NEW.provider_session_id IS NOT NULL THEN
        IF nextval('${sequence}') <= ${failures} THEN
          RAISE EXCEPTION 'Test-owned live-call receipt write failure';
        END IF;
      END IF;
      RETURN NEW;
    END
  $receipt$`);

  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER ${trigger} BEFORE UPDATE OF provider_session_id ON live_call_connections FOR EACH ROW EXECUTE FUNCTION ${fault}()`,
  );

  async function attempts(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<{ last_value: bigint }[]>(
      `SELECT last_value FROM ${sequence}`,
    );

    return Number(rows[0]?.last_value ?? 0);
  }

  return { attempts, restore };
}
