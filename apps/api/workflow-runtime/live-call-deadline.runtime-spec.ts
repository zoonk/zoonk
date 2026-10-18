import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { closeLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { type LiveCallConnection, prisma } from "@zoonk/db";
import { tagsManifest } from "next/dist/server/lib/incremental-cache/tags-manifest.external.js";
import { expect, inject, onTestFinished, test, vi } from "vitest";
import { type Run, start } from "workflow/api";
import { createWorld, setWorld } from "workflow/runtime";
import { getAllowanceCacheTag } from "../../../packages/core/src/cache/tags";
import { getLiveCallCostMicros } from "../../../packages/core/src/entitlements/limits";
import {
  liveCallFixture,
  liveCallHistoryFixture,
} from "../../../packages/core/src/language/conversations/_test-utils/live-call-fixture";
import { withNextRouteContext } from "./next-route-context";

/** Only the paid provider leaf is replaced; the compiled step calls real core and PostgreSQL. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  closeLiveCallSession: vi.fn(),
  createLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(() => false),
}));

type RuntimeWorld = Awaited<ReturnType<typeof createWorld>>;
type FlowHandler = (request: Request) => Promise<Response>;

type DirectWorld = RuntimeWorld & {
  registerHandler: (prefix: string, handler: FlowHandler) => void;
};

const INITIAL_WAIT_MS = 2000;
const FIRST_BACKOFF_MS = 5000;
const BACKOFF_TOLERANCE_MS = 100;
const WAIT_TIMEOUT_MS = 7000;
const HELD_SECONDS = 60;
const CONFIRMED_SECONDS = 15;

function isDirectWorld(world: RuntimeWorld): world is DirectWorld {
  return "registerHandler" in world && typeof world.registerHandler === "function";
}

function isFlowModule(value: unknown): value is { POST: FlowHandler } {
  return (
    typeof value === "object" &&
    value !== null &&
    "POST" in value &&
    typeof value.POST === "function"
  );
}

async function createRuntime() {
  const runtime = inject("liveCallRuntime");
  vi.stubEnv("WORKFLOW_LOCAL_DATA_DIR", resolve(runtime.root, "data"));
  const world = await createWorld();
  setWorld(world);

  onTestFinished(async () => {
    setWorld(undefined);
    await world.close?.();
    vi.unstubAllEnvs();
  });

  // registerHandler is the Local World's published in-process RequestHandler API.
  if (!isDirectWorld(world)) {
    throw new Error("The installed Local World must support direct in-process handlers.");
  }

  // Vitest's module runner loads this bundle so its external AI import sees the leaf mock.
  const flow: unknown = await import(runtime.flowPath);

  if (!isFlowModule(flow)) {
    throw new Error("The generated Workflow bundle must export its POST handler.");
  }

  world.registerHandler(
    "__wkf_workflow_",
    withNextRouteContext({ handler: flow.POST, root: runtime.root }),
  );

  return { runtime, world };
}

async function activeCallFixture() {
  const { user, conversation } = await liveCallFixture({ plus: true });
  const deadlineAt = new Date(Date.now() + INITIAL_WAIT_MS);
  const reservedMicros = getLiveCallCostMicros(HELD_SECONDS);

  const connection = await liveCallHistoryFixture({
    closedAt: null,
    conversationId: conversation.id,
    costConfidence: "reserved",
    deadlineAt,
    heldSeconds: HELD_SECONDS,
    liabilityMicros: reservedMicros,
    providerSessionId: `runtime-${randomUUID()}`,
    providerStartedAt: new Date(),
    reservedMicros,
    state: "active",
    userId: user.id,
  });

  await prisma.liveCallSlot.create({
    data: { connectionId: connection.id, generation: connection.generation, userId: user.id },
  });

  return connection;
}

async function readWaits({ runId, world }: { runId: string; world: RuntimeWorld }) {
  const events = await world.events.list({ runId });
  return events.data.filter((event) => event.eventType === "wait_created");
}

async function waitForWaits({
  count,
  runId,
  world,
}: {
  count: number;
  runId: string;
  world: RuntimeWorld;
}) {
  await expect
    .poll(() => readWaits({ runId, world }), { timeout: WAIT_TIMEOUT_MS })
    .toHaveLength(count);

  return readWaits({ runId, world });
}

async function assertHeld({
  connection,
  runId,
}: {
  connection: LiveCallConnection;
  runId: string;
}) {
  const [held, slot] = await Promise.all([
    prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: connection.userId } }),
  ]);

  expect(held).toMatchObject({
    closeAttempts: 1,
    costConfidence: "unconfirmed",
    state: "closing",
    workflowRunId: runId,
  });

  expect(held.liabilityMicros).toBeGreaterThan(0);
  expect(slot.connectionId).toBe(connection.id);
}

async function assertSettled({
  connection,
  run,
  world,
}: {
  connection: LiveCallConnection;
  run: Run<unknown>;
  world: RuntimeWorld;
}) {
  const [settled, slot, usage, runs, events] = await Promise.all([
    prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: connection.userId } }),
    prisma.usageRecord.findUniqueOrThrow({ where: { id: connection.usageRecordId } }),
    world.runs.list({ resolveData: "none" }),
    world.events.list({ runId: run.runId }),
  ]);

  expect(settled).toMatchObject({
    closeAttempts: 2,
    costConfidence: "confirmed",
    endReason: "deadline",
    liabilityMicros: 0,
    settledMicros: getLiveCallCostMicros(CONFIRMED_SECONDS),
    state: "closed",
    workflowRunId: run.runId,
  });

  expect(slot.connectionId).toBeNull();

  expect(usage).toMatchObject({
    costMicros: getLiveCallCostMicros(CONFIRMED_SECONDS),
    seconds: CONFIRMED_SECONDS,
  });

  expect(runs.data.map((entry) => entry.runId)).toStrictEqual([run.runId]);
  expect(events.data.filter((event) => event.eventType === "wait_completed")).toHaveLength(2);
  expect(tagsManifest.get(getAllowanceCacheTag(connection.userId))?.expired).toBeGreaterThan(0);
}

test("persists the deadline and retry in one real run, keeping the slot until core confirms close", async () => {
  const { runtime, world } = await createRuntime();
  const connection = await activeCallFixture();
  const close = vi.mocked(closeLiveCallSession);
  close.mockRejectedValueOnce(new Error("Provider has not confirmed termination."));
  close.mockResolvedValue({ reason: "deadline", seconds: CONFIRMED_SECONDS, status: "closed" });

  const run = await start({ workflowId: runtime.workflowId }, [
    {
      connectionId: connection.id,
      deadlineAt: connection.deadlineAt,
      generation: connection.generation,
    },
  ]);

  await prisma.liveCallConnection.update({
    data: { workflowRunId: run.runId },
    where: { id: connection.id },
  });

  const initialWaits = await waitForWaits({ count: 1, runId: run.runId, world });
  expect(initialWaits[0]?.eventData.resumeAt).toStrictEqual(connection.deadlineAt);
  expect(close).not.toHaveBeenCalled();

  // The initial deadline expires naturally. Only the longer retry wait is accelerated.
  const waits = await waitForWaits({ count: 2, runId: run.runId, world });
  const retryWait = waits[1];

  if (!retryWait) {
    throw new Error("The first failed close must persist its retry wait.");
  }

  const backoff = retryWait.eventData.resumeAt.getTime() - retryWait.createdAt.getTime();
  expect(backoff).toBeGreaterThanOrEqual(FIRST_BACKOFF_MS - BACKOFF_TOLERANCE_MS);
  expect(backoff).toBeLessThanOrEqual(FIRST_BACKOFF_MS + BACKOFF_TOLERANCE_MS);
  expect(close).toHaveBeenCalledExactlyOnceWith(connection.providerSessionId);
  await assertHeld({ connection, runId: run.runId });

  await expect(run.wakeUp({ correlationIds: [retryWait.correlationId] })).resolves.toMatchObject({
    stoppedCount: 1,
  });

  await expect(run.returnValue).resolves.toStrictEqual({ status: "closed" });
  await expect(run.status).resolves.toBe("completed");
  expect(close).toHaveBeenCalledTimes(2);
  await assertSettled({ connection, run, world });
});
