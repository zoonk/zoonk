import { type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { test as base, expect } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { answerLiveCalls } from "./live-peer";

type Learner = Awaited<ReturnType<typeof createLanguageLearner>>;

type StateContext = { context: BrowserContext; userId: string };

type StateCallResources = {
  cleanup: () => Promise<void>;
  contexts: StateContext[];
  open: (learner: Learner) => Promise<Page>;
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
    where: { state: { not: "ended" }, userId: resource.userId },
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
        .toMatchObject({ state: "ended" });
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
  const results = await Promise.allSettled(
    resources.contexts.map((resource) => cleanupStateCalls({ request, resource })),
  );

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

function createCall({ learner }: { learner: Learner }) {
  return prisma.languageConversation.create({
    data: {
      chapterId: learner.renting.id,
      goalId: learner.goal.id,
      kind: "practice",
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { conversationId },
  });
}

async function closeBehavior({
  request,
  sessionId,
  mode,
}: {
  request: APIRequestContext;
  sessionId: string | null;
  mode: "confirm" | "hold" | "reject";
}) {
  const bridge = process.env.LIVE_CALL_TEST_PROVIDER_URL;

  if (!bridge || !sessionId) {
    throw new Error("These call states require the lane-owned AI boundary bridge.");
  }

  const response = await request.post(`${bridge}/control/sessions/${sessionId}/behavior`, {
    data: { closeMode: mode },
    timeout: 5000,
  });

  expect(response.ok()).toBe(true);
}

/** Whether the server asked the lane's provider to hang this session up. */
async function hangupRequested({
  request,
  sessionId,
}: {
  request: APIRequestContext;
  sessionId: string | null;
}) {
  const bridge = process.env.LIVE_CALL_TEST_PROVIDER_URL;
  const response = await request.get(`${bridge}/control/sessions`);
  const sessions: unknown = await response.json();

  return (
    Array.isArray(sessions) &&
    sessions.some(
      (session: unknown) =>
        isJsonObject(session) && session.id === sessionId && session.closeRequested === true,
    )
  );
}

async function restorePeerClosures({
  request,
  userId,
}: {
  request: APIRequestContext;
  userId: string;
}) {
  const connections = await prisma.liveCallConnection.findMany({
    where: { providerSessionId: { not: null }, state: { not: "ended" }, userId },
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

type CallActions = {
  complete: { connectionId: string; turns: unknown[] }[];
  end: string[];
  reserve: { takeover: boolean }[];
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

      if (typeof input.takeover === "boolean") {
        actions.reserve.push({ takeover: input.takeover });
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

test.describe("Live call server states", () => {
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
      // The takeover's hangup waits on the provider while the learner leaves.
      await expect
        .poll(() => hangupRequested({ request, sessionId: original.providerSessionId }))
        .toBe(true);

      await leaveAndReturn({ callId, learner, page });
      await closeBehavior({ mode: "confirm", request, sessionId: original.providerSessionId });

      await expect
        .poll(() => prisma.liveCallConnection.findFirst({ where: { conversationId: callId } }))
        .toMatchObject({ providerSessionId: null, state: "ended" });

      const cancelled = await connectionFor(callId);
      expect(actions.end).toContain(cancelled.id);
      expect(actions.sdp).toHaveLength(0);
      expect(actions.complete).toHaveLength(0);
      await expect(callAlert(page)).toContainText("The call didn't connect");

      await expect(
        prisma.liveCallConnection.findUnique({ where: { id: original.id } }),
      ).resolves.toMatchObject({ endReason: "takeover", state: "ended" });
    } finally {
      await owned.cleanup();
    }
  });

  test("an End OpenAI didn't confirm retains the transcript, and retry completes only the originating ended connection", async ({
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
      ).toMatchObject({ state: "ended" });
    } finally {
      await owned.cleanup();
    }
  });
});
