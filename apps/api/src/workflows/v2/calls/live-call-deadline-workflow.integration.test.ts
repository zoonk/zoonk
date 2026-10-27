import { waitForSleep } from "@workflow/vitest";
import { hangUpLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { liveCallDeadlineWorkflow } from "./live-call-deadline-workflow";

/** Only the paid provider leaf is replaced; the compiled steps run real core and PostgreSQL. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  createLiveCallSession: vi.fn(),
  hangUpLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(() => true),
}));

const HELD_SECONDS = 60;
const HOUR_MS = 3_600_000;

/** A Plus learner's live connection, as the SDP step leaves it, whose deadline is an hour away. */
async function liveConnection() {
  const user = await userFixture();
  const startedAt = new Date();
  const providerSessionId = `live_${crypto.randomUUID()}`;

  const connection = await prisma.liveCallConnection.create({
    data: {
      conversationId: crypto.randomUUID(),
      costMicros: 72_500,
      deadlineAt: new Date(startedAt.getTime() + HOUR_MS),
      heldSeconds: HELD_SECONDS,
      providerSessionId,
      startedAt,
      state: "live",
      userId: user.id,
    },
  });

  await prisma.usageRecord.create({
    data: {
      costMicros: connection.costMicros,
      kind: "conversation",
      seconds: HELD_SECONDS,
      targetId: connection.id,
      userId: user.id,
    },
  });

  return connection;
}

describe(liveCallDeadlineWorkflow, () => {
  beforeEach(() => {
    vi.mocked(hangUpLiveCallSession).mockReset();
  });

  it("[1] sleeps until the deadline, then hangs the call up and settles it", async () => {
    const connection = await liveConnection();

    const run = await start(liveCallDeadlineWorkflow, [
      { connectionId: connection.id, deadlineAt: connection.deadlineAt },
    ]);

    const sleepId = await waitForSleep(run);
    expect(hangUpLiveCallSession).not.toHaveBeenCalled();

    await getRun(run.runId).wakeUp({ correlationIds: [sleepId] });
    await run.returnValue;

    expect(hangUpLiveCallSession).toHaveBeenCalledExactlyOnceWith(connection.providerSessionId);

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({ endReason: "deadline", state: "ended" });

    await expect(
      prisma.usageRecord.findFirstOrThrow({ where: { targetId: connection.id } }),
    ).resolves.toMatchObject({ seconds: expect.any(Number) });
  });

  it("[1] retries a hangup OpenAI didn't confirm in the same run", async () => {
    const connection = await liveConnection();
    vi.mocked(hangUpLiveCallSession).mockRejectedValueOnce(new Error("OpenAI is unavailable"));

    const run = await start(liveCallDeadlineWorkflow, [
      { connectionId: connection.id, deadlineAt: connection.deadlineAt },
    ]);

    await getRun(run.runId).wakeUp({ correlationIds: [await waitForSleep(run)] });
    await run.returnValue;

    expect(hangUpLiveCallSession).toHaveBeenCalledTimes(2);

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({ state: "ended" });
  });
});
