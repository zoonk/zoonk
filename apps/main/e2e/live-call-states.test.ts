import { randomUUID } from "node:crypto";
import { type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { getNumber, getString, isJsonObject } from "@zoonk/utils/json";
import { test as base, expect } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { answerLiveCalls } from "./live-peer";

const CONNECTIONS_PER_CALL = 6;
const CONNECTIONS_PER_DAY = 30;

type Learner = Awaited<ReturnType<typeof createLanguageLearner>>;

type StateContext = { context: BrowserContext; userId: string };

type StateCallResources = {
  cleanup: () => Promise<void>;
  contexts: StateContext[];
  open: (learner: Learner) => Promise<Page>;
  restoreAdmission: (() => Promise<unknown>) | null;
};

function assertCleanup(results: PromiseSettledResult<unknown>[]) {
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result): unknown => result.reason);

  if (errors.length > 0) {
    throw new AggregateError(errors, "State call cleanup failed");
  }
}

async function cleanupStateCalls({
  request,
  resource,
}: {
  request: APIRequestContext;
  resource: StateContext;
}) {
  const restored = await Promise.allSettled([
    restorePeerClosures({ request, userId: resource.userId }),
  ]);

  const connections = await prisma.liveCallConnection.findMany({
    where: { state: { not: "closed" }, userId: resource.userId },
  });

  if (connections.length === 0) {
    assertCleanup(restored);
    return;
  }

  const api = process.env.NEXT_PUBLIC_API_URL;

  if (!api || !["localhost", "127.0.0.1"].includes(new URL(api).hostname)) {
    throw new Error("State call cleanup requires the lane-owned API origin.");
  }

  const ended = await Promise.allSettled(
    connections.map(async (connection) => {
      const response = await resource.context.request.post(
        `${api}/v1/language-conversations/${connection.conversationId}/connections/${connection.id}/end`,
        { data: {}, headers: { Origin: new URL(api).origin }, timeout: 15_000 },
      );

      expect(response.ok()).toBe(true);

      await expect
        .poll(() => prisma.liveCallConnection.findUnique({ where: { id: connection.id } }), {
          timeout: 5000,
        })
        .toMatchObject({ state: "closed" });
    }),
  );

  assertCleanup([...restored, ...ended]);
}

async function cleanupStateResources({
  request,
  resources,
}: {
  request: APIRequestContext;
  resources: StateCallResources;
}) {
  const results = await Promise.allSettled([
    resources.restoreAdmission?.(),
    ...resources.contexts.map((resource) => cleanupStateCalls({ request, resource })),
  ]);

  assertCleanup(results);
}

/** Teardown keeps auth contexts and request/browser dependencies alive, with a budget independent of the body. */
const test = base.extend<{ stateCallResources: StateCallResources }>({
  stateCallResources: [
    async ({ browser, request }, use) => {
      const resources: StateCallResources = {
        cleanup: () => cleanupStateResources({ request, resources }),
        contexts: [],
        open: async (learner) => {
          const context = await browser.newContext({ storageState: learner.user.storageState });
          resources.contexts.push({ context, userId: learner.user.id });
          return context.newPage();
        },
        restoreAdmission: null,
      };

      try {
        await use(resources);
      } finally {
        try {
          await resources.cleanup();
        } finally {
          const closed = await Promise.allSettled(
            resources.contexts.map(({ context }) => context.close()),
          );

          assertCleanup(closed);
        }
      }
    },
    { timeout: 30_000 },
  ],
});

function createCall({
  learner,
  kind = "practice",
}: {
  learner: Learner;
  kind?: "checkpoint" | "practice";
}) {
  return prisma.languageConversation.create({
    data: {
      chapterId: learner.renting.id,
      goalId: learner.goal.id,
      kind,
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes: 1,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: learner.user.id,
    },
  });
}

function connectionFor(conversationId: string) {
  return prisma.liveCallConnection.findFirstOrThrow({
    orderBy: [{ createdAt: "desc" }, { attemptNumber: "desc" }],
    where: { conversationId },
  });
}

async function closeBehavior({
  request,
  sessionId,
  mode,
  rejectCloses = 0,
}: {
  request: APIRequestContext;
  sessionId: string | null;
  mode: "confirm" | "hold" | "reject";
  rejectCloses?: number;
}) {
  const bridge = process.env.LIVE_CALL_TEST_PROVIDER_URL;

  if (!bridge || !sessionId) {
    throw new Error("These call states require the lane-owned AI boundary bridge.");
  }

  const response = await request.post(`${bridge}/control/sessions/${sessionId}/behavior`, {
    data: { closeMode: mode, rejectCloses },
    timeout: 5000,
  });

  expect(response.ok()).toBe(true);
}

async function restorePeerClosures({
  request,
  userId,
}: {
  request: APIRequestContext;
  userId: string;
}) {
  const connections = await prisma.liveCallConnection.findMany({
    where: { providerSessionId: { not: null }, state: { not: "closed" }, userId },
  });

  await Promise.all(
    connections.map((connection) =>
      closeBehavior({ mode: "confirm", request, sessionId: connection.providerSessionId }),
    ),
  );
}

async function expectLive(page: Page) {
  await expect(
    page
      .getByRole("log", { name: "Conversation" })
      .getByText("Hi! Are you calling about the apartment?"),
  ).toBeVisible();
}

/** CallOffMessage and SavingCall are inside TaskFrame; Next's route announcer is outside it. */
function callAlert(page: Page) {
  return page.locator('[data-slot="task-frame-body"]').getByRole("alert");
}

async function pastAttempts({
  callId,
  count,
  userId,
  sameCall,
}: {
  callId: string;
  count: number;
  userId: string;
  sameCall: boolean;
}) {
  const now = new Date();

  const usage = await prisma.usageRecord.create({
    data: { kind: "conversation", seconds: 0, targetId: callId, userId },
  });

  await prisma.liveCallConnection.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      attemptNumber: index + 1,
      closedAt: now,
      conversationId: sameCall ? callId : randomUUID(),
      costConfidence: "confirmed" as const,
      createdAt: now,
      deadlineAt: now,
      generation: index + 1,
      heldSeconds: 0,
      liabilityMicros: 0,
      requestId: randomUUID(),
      reservedMicros: 0,
      state: "closed" as const,
      usageRecordId: usage.id,
      userId,
    })),
  });
}

type CallActions = {
  complete: { connectionId: string; turns: unknown[] }[];
  end: string[];
  reserve: { requestId: string; takeover: boolean }[];
  sdp: unknown[];
};

/** Observe the real Next action transport; no action, API or broker interception. */
function observeActions({ page, conversationId }: { page: Page; conversationId: string }) {
  const actions: CallActions = { complete: [], end: [], reserve: [], sdp: [] };

  page.on("request", (request) => {
    if (request.method() !== "POST") {
      return;
    }

    if (request.url().includes(`/conversation/${conversationId}/live-session/`)) {
      const body: unknown = request.postDataJSON();
      actions.sdp.push(body);
      return;
    }

    if (!request.headers()["next-action"]) {
      return;
    }

    const args: unknown = JSON.parse(request.postData() ?? "null");

    if (!Array.isArray(args)) {
      return;
    }

    const named: unknown = args[0];

    if (isJsonObject(named) && getString(named, "conversationId") === conversationId) {
      const input: unknown = named.input;

      if (!isJsonObject(input)) {
        return;
      }

      const requestId = getString(input, "requestId");

      if (requestId && typeof input.takeover === "boolean") {
        actions.reserve.push({ requestId, takeover: input.takeover });
      }

      return;
    }

    if (args[0] !== conversationId) {
      return;
    }

    const input: unknown = args[1];

    if (typeof input === "string") {
      actions.end.push(input);
      return;
    }

    if (!isJsonObject(input)) {
      return;
    }

    const connectionId = getString(input, "connectionId");

    if (connectionId && Array.isArray(input.turns)) {
      actions.complete.push({ connectionId, turns: input.turns });
    }
  });

  return actions;
}

async function applyPeerAnswer(page: Page) {
  await page.evaluate(async () => {
    const apply: unknown = Reflect.get(globalThis, "e2eLiveApplyAnswers");

    const guard = {
      isApply(value: unknown): value is () => Promise<void> {
        return typeof value === "function";
      },
    };

    if (!guard.isApply(apply)) {
      throw new TypeError("Missing platform answer control.");
    }

    await apply();
  });
}

async function peerSnapshot(page: Page) {
  return page.evaluate(() => {
    const read: unknown = Reflect.get(globalThis, "e2eLivePeerSnapshot");

    const guard = {
      isRead(value: unknown): value is () => unknown {
        return typeof value === "function";
      },
    };

    if (!guard.isRead(read)) {
      throw new TypeError("Missing platform peer snapshot");
    }

    return read();
  });
}

async function holdMicrophone(page: Page) {
  await page.addInitScript(() => {
    const held = {
      contexts: [] as AudioContext[],
      pending: [] as ((stream: MediaStream) => void)[],
      streams: [] as MediaStream[],
      token: crypto.randomUUID(),
    };

    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        new Promise<MediaStream>((resolve) => {
          held.pending.push(resolve);
        }),
    });

    const release = async () => {
      const context = new AudioContext();
      const source = context.createConstantSource();
      const output = context.createMediaStreamDestination();
      source.offset.value = 0;
      source.connect(output);
      source.start();
      held.contexts.push(context);
      held.streams.push(output.stream);
      await context.resume();

      for (const resolve of held.pending.splice(0)) {
        resolve(output.stream);
      }
    };

    const snapshot = () => ({
      pending: held.pending.length,
      token: held.token,
      tracks: held.streams.flatMap((stream) =>
        stream.getAudioTracks().map((track) => track.readyState),
      ),
    });

    Object.assign(globalThis, { e2eHeldMicrophone: snapshot, e2eReleaseMicrophone: release });
  });
}

async function microphoneSnapshot(page: Page) {
  return page.evaluate(() => {
    const read: unknown = Reflect.get(globalThis, "e2eHeldMicrophone");

    const guard = {
      isRead(value: unknown): value is () => unknown {
        return typeof value === "function";
      },
    };

    if (!guard.isRead(read)) {
      throw new TypeError("Missing held platform microphone");
    }

    return read();
  });
}

async function releaseMicrophone(page: Page) {
  await page.evaluate(async () => {
    const release: unknown = Reflect.get(globalThis, "e2eReleaseMicrophone");

    const guard = {
      isRelease(value: unknown): value is () => Promise<void> {
        return typeof value === "function";
      },
    };

    if (!guard.isRelease(release)) {
      throw new TypeError("Missing held microphone release");
    }

    await release();
  });
}

async function openUnitCall({ learner, page }: { learner: Learner; page: Page }) {
  await page.goto(`/content/units/${learner.renting.id}`);
  await page.getByRole("button", { name: "Practice a conversation" }).click();
  const dialog = page.getByRole("dialog", { name: "Practice a conversation" });
  await dialog.getByText("1 min", { exact: true }).click();
  await expect(dialog.getByRole("radio", { exact: true, name: "1 min" })).toBeChecked();
  await dialog.getByRole("button", { name: "Start the call" }).click();
  await expect(page).toHaveURL(/\/conversation\/[\da-f-]{36}$/u);
  const id = new URL(page.url()).pathname.split("/").at(-1);

  if (!id) {
    throw new Error("The real unit CTA did not open its call.");
  }

  return id;
}

async function leaveAndReturn({
  callId,
  learner,
  page,
}: {
  callId: string;
  learner: Learner;
  page: Page;
}) {
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/content/units/${learner.renting.id}$`, "u"));
  await expect(page.getByRole("button", { name: "Practice a conversation" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/conversation/${callId}$`, "u"));
  await expect(callAlert(page)).toContainText("The call didn't connect");
}

/** Run this file alone: its paused case changes the real singleton admission setting, restored in finally. */
test.describe("Live call server states", () => {
  test.describe.configure({ mode: "serial" });

  test("two tabs require explicit takeover and the old call earns no feedback", async ({
    stateCallResources: owned,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const [first, second] = await Promise.all([createCall({ learner }), createCall({ learner })]);
    const oldTab = await owned.open(learner);

    try {
      const oldPeer = await answerLiveCalls(oldTab, "answers");
      await oldTab.goto(`/conversation/${first.id}`);
      await oldTab.getByRole("button", { name: "Start the call" }).click();
      await expectLive(oldTab);
      const original = await connectionFor(first.id);
      const newTab = await oldTab.context().newPage();
      await answerLiveCalls(newTab, "answers");
      const actions = observeActions({ conversationId: second.id, page: newTab });
      await newTab.goto(`/conversation/${second.id}`);
      await newTab.getByRole("button", { name: "Start the call" }).click();
      await expect(callAlert(newTab)).toContainText("You're already in a call");

      await expect(
        newTab.getByRole("button", { name: "End that call and start this one" }),
      ).toBeVisible();

      expect(await prisma.liveCallConnection.count({ where: { conversationId: second.id } })).toBe(
        0,
      );

      expect(
        await prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
      ).toMatchObject({ connectionId: original.id });

      await newTab.getByRole("button", { name: "End that call and start this one" }).click();
      await expectLive(newTab);
      expect(actions.reserve).toHaveLength(2);
      expect(actions.reserve[0]?.takeover).toBe(false);
      expect(actions.reserve[1]?.takeover).toBe(true);
      expect(actions.reserve[1]?.requestId).not.toBe(actions.reserve[0]?.requestId);

      const [replaced, current] = await Promise.all([
        prisma.liveCallConnection.findUniqueOrThrow({ where: { id: original.id } }),
        connectionFor(second.id),
      ]);

      expect(replaced).toMatchObject({
        costConfidence: "confirmed",
        endReason: "takeover",
        state: "closed",
      });

      expect(current.state).toBe("active");

      expect(current.providerStartedAt?.getTime()).toBeGreaterThanOrEqual(
        replaced.closedAt?.getTime() ?? Number.POSITIVE_INFINITY,
      );

      await oldPeer.emit({
        reason: "close_requested",
        session: { id: original.providerSessionId },
        type: "session.closed",
        usage: { seconds: 15 },
      });

      await expect(callAlert(oldTab)).toContainText("It ended when you started another call.");

      const saved = await prisma.languageConversation.findUniqueOrThrow({
        where: { id: first.id },
      });

      expect(saved).toMatchObject({ feedback: null, status: "ready" });
    } finally {
      await owned.cleanup();
    }
  });

  test("reconnect retries once and retains the slot until confirmed", async ({
    stateCallResources: owned,
    request,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const call = await createCall({ learner });
    const firstTab = await owned.open(learner);

    try {
      const firstPeer = await answerLiveCalls(firstTab, "answers");
      await firstTab.goto(`/conversation/${call.id}`);
      await firstTab.getByRole("button", { name: "Start the call" }).click();
      await expectLive(firstTab);
      const original = await connectionFor(call.id);
      /** The first close fails; the automatic retry waits at the external boundary. */
      await closeBehavior({
        mode: "hold",
        rejectCloses: 1,
        request,
        sessionId: original.providerSessionId,
      });

      const returning = await firstTab.context().newPage();
      await answerLiveCalls(returning, "answers");
      const actions = observeActions({ conversationId: call.id, page: returning });
      await returning.goto(`/conversation/${call.id}`);
      await returning.getByRole("button", { name: "Start the call" }).click();

      await expect(
        returning
          .locator('[data-slot="task-frame-body"]')
          .getByRole("status")
          .filter({ hasText: /^Reconnecting…$/u }),
      ).toBeVisible();

      await expect
        .poll(() => prisma.liveCallConnection.findUnique({ where: { id: original.id } }))
        .toMatchObject({ closeAttempts: 2, state: "closing" });

      expect(actions.reserve).toHaveLength(2);
      expect(actions.reserve[1]).toEqual(actions.reserve[0]);
      await closeBehavior({ mode: "reject", request, sessionId: original.providerSessionId });
      await expect(callAlert(returning)).toContainText("The call didn't connect");

      expect(await prisma.liveCallConnection.count({ where: { conversationId: call.id } })).toBe(1);

      expect(
        await prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
      ).toMatchObject({ connectionId: original.id });

      expect(
        await prisma.liveCallConnection.findUnique({ where: { id: original.id } }),
      ).toMatchObject({ closeAttempts: 2, costConfidence: "unconfirmed", state: "closing" });

      await closeBehavior({ mode: "confirm", request, sessionId: original.providerSessionId });
      await returning.getByRole("button", { exact: true, name: "Try again" }).click();
      await expectLive(returning);
      expect(actions.reserve).toHaveLength(3);
      expect(actions.reserve[2]?.requestId).not.toBe(actions.reserve[0]?.requestId);
      const current = await connectionFor(call.id);
      expect(current.id).not.toBe(original.id);
      expect(current.generation).toBeGreaterThan(original.generation);

      expect(
        await prisma.liveCallConnection.findUnique({ where: { id: original.id } }),
      ).toMatchObject({ costConfidence: "confirmed", endReason: "reconnect", state: "closed" });

      await firstPeer.emit({
        reason: "close_requested",
        session: { id: original.providerSessionId },
        type: "session.closed",
        usage: { seconds: 15 },
      });

      await expect(callAlert(firstTab)).toContainText("Start a new call to keep practicing.");

      expect(
        await prisma.liveCallConnection.findUnique({ where: { id: current.id } }),
      ).toMatchObject({ state: "active" });

      expect(
        await prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
      ).toMatchObject({ connectionId: current.id });

      expect(
        await prisma.languageConversation.findUnique({ where: { id: call.id } }),
      ).toMatchObject({ feedback: null, status: "ready" });
    } finally {
      await owned.cleanup();
    }
  });

  test("paused call recovery enables the unit sheet without a reload", async ({
    stateCallResources: owned,
  }) => {
    const learner = await createLanguageLearner();
    const setting = await prisma.liveCallSetting.findUniqueOrThrow({ where: { id: "live" } });
    const page = await owned.open(learner);

    owned.restoreAdmission = () =>
      prisma.liveCallSetting.update({
        data: {
          admission: setting.admission,
          freeDailyBudgetMicros: setting.freeDailyBudgetMicros,
        },
        where: { id: "live" },
      });

    try {
      await prisma.liveCallSetting.update({ data: { admission: "all" }, where: { id: "live" } });
      const callId = await openUnitCall({ learner, page });
      await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });
      await page.getByRole("button", { name: "Start the call" }).click();
      await expect(callAlert(page)).toContainText("Calls are paused");
      await expect(page.getByRole("link", { exact: true, name: "Back" })).toBeVisible();

      expect(await prisma.liveCallConnection.count({ where: { conversationId: callId } })).toBe(0);

      expect(
        await prisma.usageRecord.count({
          where: { kind: "conversation", targetId: callId, userId: learner.user.id },
        }),
      ).toBe(0);

      await prisma.liveCallSetting.update({ data: { admission: "all" }, where: { id: "live" } });
      await page.getByRole("link", { exact: true, name: "Back" }).click();
      await expect(page).toHaveURL(new RegExp(`/content/units/${learner.renting.id}$`, "u"));
      await page.getByRole("button", { name: "Practice a conversation" }).click();
      const sheet = page.getByRole("dialog", { name: "Practice a conversation" });
      await expect(sheet.getByRole("button", { name: "Start the call" })).toBeEnabled();
      await sheet.getByRole("button", { exact: true, name: "Close" }).click();
      await page.getByRole("button", { name: "Practice a conversation" }).click();
      await expect(sheet.getByRole("button", { name: "Start the call" })).toBeEnabled();
      await sheet.getByRole("button", { exact: true, name: "Close" }).click();
    } finally {
      await owned.cleanup();
    }
  });

  test("paused speaking tasks show the notice before generation", async ({
    stateCallResources: owned,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const setting = await prisma.liveCallSetting.findUniqueOrThrow({ where: { id: "live" } });

    await prisma.goal.update({
      data: { targetLanguage: "es", title: "DELE B2" },
      where: { id: learner.goal.id },
    });

    const page = await owned.open(learner);

    owned.restoreAdmission = () =>
      prisma.liveCallSetting.update({
        data: {
          admission: setting.admission,
          freeDailyBudgetMicros: setting.freeDailyBudgetMicros,
        },
        where: { id: "live" },
      });

    try {
      await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });
      await page.goto("/speaking?task=t1");
      const tasks = page.getByRole("region", { exact: true, name: "Tasks" });

      await expect(
        tasks.getByText("It's the same for everyone right now. Try again later."),
      ).toBeVisible();

      const task = tasks.getByRole("listitem").filter({ hasText: "Tarea 1:" });
      await expect(task.getByText("Calls are paused", { exact: true })).toBeVisible();
      await expect(tasks.getByRole("button", { name: "Start this task" })).toHaveCount(0);
      await expect(tasks.getByRole("link", { name: "See Plus" })).toHaveCount(0);

      expect(await prisma.languageConversation.count({ where: { userId: learner.user.id } })).toBe(
        0,
      );

      expect(await prisma.liveCallConnection.count({ where: { userId: learner.user.id } })).toBe(0);
    } finally {
      await owned.cleanup();
    }
  });

  test("paused calls are shown before the unit's call length configuration", async ({
    stateCallResources: owned,
  }) => {
    const learner = await createLanguageLearner();
    const setting = await prisma.liveCallSetting.findUniqueOrThrow({ where: { id: "live" } });
    const page = await owned.open(learner);

    owned.restoreAdmission = () =>
      prisma.liveCallSetting.update({
        data: {
          admission: setting.admission,
          freeDailyBudgetMicros: setting.freeDailyBudgetMicros,
        },
        where: { id: "live" },
      });

    try {
      await prisma.liveCallSetting.update({ data: { admission: "off" }, where: { id: "live" } });
      await page.goto(`/content/units/${learner.renting.id}`);
      const row = page.getByRole("button", { name: "Practice a conversation" });
      await expect(row).toContainText("Calls are paused");
      await row.click();

      const sheet = page.getByRole("dialog", { name: "Practice a conversation" });
      await expect(sheet.getByText("Calls are paused", { exact: true })).toBeVisible();

      await expect(
        sheet.getByText("It's the same for everyone right now. Try again later."),
      ).toBeVisible();

      await expect(sheet.getByRole("group", { name: "Call length" })).toHaveCount(0);
      await expect(sheet.getByRole("radio")).toHaveCount(0);
      await expect(sheet.getByRole("button", { name: "Start the call" })).toHaveCount(0);

      expect(await prisma.languageConversation.count({ where: { userId: learner.user.id } })).toBe(
        0,
      );

      expect(await prisma.liveCallConnection.count({ where: { userId: learner.user.id } })).toBe(0);
    } finally {
      await owned.cleanup();
    }
  });

  test("a microphone resolving after Activity hide and return cannot restart the cancelled call", async ({
    stateCallResources: owned,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const page = await owned.open(learner);

    try {
      await holdMicrophone(page);
      await answerLiveCalls(page, "answers");
      const callId = await openUnitCall({ learner, page });
      const actions = observeActions({ conversationId: callId, page });
      await page.getByRole("button", { name: "Start the call" }).click();
      await expect.poll(() => microphoneSnapshot(page)).toMatchObject({ pending: 1 });
      const token = getString(await microphoneSnapshot(page), "token");
      expect(token).toBeTruthy();
      await leaveAndReturn({ callId, learner, page });
      expect(getString(await microphoneSnapshot(page), "token")).toBe(token);
      await releaseMicrophone(page);

      await expect
        .poll(() => microphoneSnapshot(page))
        .toMatchObject({ pending: 0, tracks: ["ended"] });

      await expect(callAlert(page)).toContainText("The call didn't connect");
      expect(actions.reserve).toHaveLength(0);
      expect(actions.sdp).toHaveLength(0);
      expect(actions.complete).toHaveLength(0);
      expect(await prisma.liveCallConnection.count({ where: { conversationId: callId } })).toBe(0);

      expect(
        await prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
      ).toBeNull();
    } finally {
      await owned.cleanup();
    }
  });

  test("a reservation resolving after Activity return is ended by its own ID without SDP", async ({
    stateCallResources: owned,
    request,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const first = await createCall({ learner });
    const firstTab = await owned.open(learner);
    const page = await firstTab.context().newPage();

    try {
      await answerLiveCalls(firstTab, "answers");
      await firstTab.goto(`/conversation/${first.id}`);
      await firstTab.getByRole("button", { name: "Start the call" }).click();
      await expectLive(firstTab);
      const original = await connectionFor(first.id);
      await closeBehavior({ mode: "hold", request, sessionId: original.providerSessionId });
      await answerLiveCalls(page, "answers");
      const callId = await openUnitCall({ learner, page });
      const actions = observeActions({ conversationId: callId, page });
      await page.getByRole("button", { name: "Start the call" }).click();
      await page.getByRole("button", { name: "End that call and start this one" }).click();

      await expect
        .poll(() => prisma.liveCallConnection.findUnique({ where: { id: original.id } }))
        .toMatchObject({ state: "closing" });

      await leaveAndReturn({ callId, learner, page });
      await closeBehavior({ mode: "confirm", request, sessionId: original.providerSessionId });

      await expect
        .poll(() => prisma.liveCallConnection.findFirst({ where: { conversationId: callId } }))
        .toMatchObject({ providerSessionId: null, state: "closed" });

      const cancelled = await connectionFor(callId);
      expect(actions.end).toContain(cancelled.id);
      expect(actions.sdp).toHaveLength(0);
      expect(actions.complete).toHaveLength(0);
      await expect(callAlert(page)).toContainText("The call didn't connect");

      expect(
        await prisma.liveCallSlot.findUnique({ where: { userId: learner.user.id } }),
      ).toMatchObject({ connectionId: null });
    } finally {
      await owned.cleanup();
    }
  });

  test("a late platform audio track after connecting End stays silent while server close is unconfirmed", async ({
    stateCallResources: owned,
    request,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const call = await createCall({ learner });
    const page = await owned.open(learner);

    try {
      const peer = await answerLiveCalls(page, "answers", { holdAnswer: true });
      const actions = observeActions({ conversationId: call.id, page });
      await page.goto(`/conversation/${call.id}`);
      await page.getByRole("button", { name: "Start the call" }).click();
      await peer.asked;
      const connection = await connectionFor(call.id);
      expect(connection.state).toBe("active");
      expect(actions.sdp).toHaveLength(1);
      await expect.poll(() => peerSnapshot(page)).toMatchObject({ pendingAnswers: 1 });
      await closeBehavior({ mode: "hold", request, sessionId: connection.providerSessionId });
      await page.getByRole("button", { exact: true, name: "End" }).click();
      await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

      await expect
        .poll(() => prisma.liveCallConnection.findUnique({ where: { id: connection.id } }))
        .toMatchObject({ state: "closing" });

      expect(await peerSnapshot(page)).toMatchObject({ playingEvents: 0 });
      await applyPeerAnswer(page);

      await expect
        .poll(async () => getNumber(await peerSnapshot(page), "playingEvents"))
        .toBeGreaterThanOrEqual(1);

      await expect
        .poll(() => peerSnapshot(page))
        .toMatchObject({
          mediaPaused: [true],
          peers: [{ capture: "ended", connection: "connected", track: null }],
          pendingAnswers: 0,
        });

      expect(
        await prisma.liveCallConnection.findUnique({ where: { id: connection.id } }),
      ).toMatchObject({ state: "closing" });

      await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
      expect(actions.complete).toHaveLength(0);

      expect(
        await prisma.languageConversation.findUnique({ where: { id: call.id } }),
      ).toMatchObject({ feedback: null, status: "ready" });

      await closeBehavior({ mode: "confirm", request, sessionId: connection.providerSessionId });

      await expect
        .poll(() => prisma.liveCallConnection.findUnique({ where: { id: connection.id } }))
        .toMatchObject({ state: "closed" });
    } finally {
      await owned.cleanup();
    }
  });

  test("unconfirmed End retains the transcript and retry completes only the originating closed connection", async ({
    stateCallResources: owned,
    request,
  }) => {
    const learner = await createLanguageLearner({ withSubscription: true });
    const call = await createCall({ learner });
    const page = await owned.open(learner);

    try {
      const peer = await answerLiveCalls(page, "answers");
      const actions = observeActions({ conversationId: call.id, page });
      await page.goto(`/conversation/${call.id}`);
      await page.getByRole("button", { name: "Start the call" }).click();
      await expectLive(page);
      const connection = await connectionFor(call.id);
      await page.getByRole("textbox", { name: "Type your reply" }).fill("Please keep this reply.");
      await page.getByRole("button", { exact: true, name: "Send" }).click();

      await expect(
        page.getByRole("log", { name: "Conversation" }).getByText("Please keep this reply."),
      ).toBeVisible();

      await closeBehavior({ mode: "reject", request, sessionId: connection.providerSessionId });
      await page.getByRole("button", { exact: true, name: "End" }).click();

      await expect(callAlert(page)).toContainText(
        "The call is still closing. Try again in a moment.",
      );

      expect(actions.end).toContain(connection.id);
      expect(actions.complete).toHaveLength(0);

      await peer.emit({
        delta: " Late words must not be saved.",
        end_ms: 10_000,
        start_ms: 9000,
        type: "session.output_transcript.delta",
      });

      await peer.emit({ session: { id: connection.providerSessionId }, type: "session.started" });

      await expect(callAlert(page)).toContainText(
        "The call is still closing. Try again in a moment.",
      );

      expect(actions.complete).toHaveLength(0);

      expect(
        await prisma.languageConversation.findUnique({ where: { id: call.id } }),
      ).toMatchObject({ feedback: null, status: "ready" });

      await closeBehavior({ mode: "confirm", request, sessionId: connection.providerSessionId });
      await page.getByRole("button", { exact: true, name: "Try again" }).click();
      await expect.poll(() => actions.complete.length).toBe(1);
      expect(actions.complete[0]?.connectionId).toBe(connection.id);

      expect(actions.complete[0]?.turns).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: "Please keep this reply." })]),
      );

      expect(JSON.stringify(actions.complete[0]?.turns)).not.toContain(
        "Late words must not be saved",
      );

      expect(
        await prisma.liveCallConnection.findUnique({ where: { id: connection.id } }),
      ).toMatchObject({ state: "closed" });
    } finally {
      await owned.cleanup();
    }
  });

  for (const period of ["conversation", "day"] as const) {
    test(`${period} attempt refusal preserves the existing recovery and avoids a Plus upsell`, async ({
      stateCallResources: owned,
    }) => {
      const learner = await createLanguageLearner({ withSubscription: true });
      const call = await createCall({ learner });
      const count = period === "conversation" ? CONNECTIONS_PER_CALL : CONNECTIONS_PER_DAY;

      await pastAttempts({
        callId: call.id,
        count,
        sameCall: period === "conversation",
        userId: learner.user.id,
      });

      const page = await owned.open(learner);

      try {
        await answerLiveCalls(page, "answers");
        await page.goto(`/conversation/${call.id}`);
        await page.getByRole("button", { name: "Start the call" }).click();

        await expect(callAlert(page)).toContainText(
          period === "conversation" ? "This call has ended" : "No more calls today",
        );

        await expect(page.getByRole("link", { exact: true, name: "Back" })).toBeVisible();
        await expect(page.getByRole("link", { name: "See Plus" })).toBeHidden();

        expect(await prisma.liveCallConnection.count({ where: { userId: learner.user.id } })).toBe(
          count,
        );
      } finally {
        await owned.cleanup();
      }
    });
  }
});
