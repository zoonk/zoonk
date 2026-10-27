import { type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { getString } from "@zoonk/utils/json";
import { TEST_LIVE_SDP_ANSWER } from "../../../packages/e2e/src/live-call-provider";
import { test as base, expect } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { openAs } from "./study-day";

const NATIVE_SETUP_TIMEOUT_MS = 8000;
const NATIVE_TEARDOWN_TIMEOUT_MS = 30_000;

/**
 * When the call's server deadline falls, counted from its Start. A checkpoint's call time runs
 * from its first connection, so an earlier one sets it; a practice call holds at least a minute.
 */
const DEADLINE_MS = 25_000;

type NativeCallResources = {
  answer: string | null;
  bridge: string;
  conversationId: string | null;
  offer: string | null;
  page: Page | null;
  peerContext: BrowserContext;
};

type BridgeSession = {
  awaitingAnswer: boolean;
  id: string;
  sdp: string;
  realPeer: boolean;
  closeRequested: boolean;
  closeRequestedAt: number | null;
};

type NativePeer = {
  audio: AudioContext;
  channel: RTCDataChannel | null;
  closeCommands: number;
  oscillator: OscillatorNode;
  pc: RTCPeerConnection;
};

function isBridgeSession(value: unknown): value is BridgeSession {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    value !== null &&
    "awaitingAnswer" in value &&
    typeof value.awaitingAnswer === "boolean" &&
    "id" in value &&
    typeof value.id === "string" &&
    "sdp" in value &&
    typeof value.sdp === "string" &&
    "realPeer" in value &&
    typeof value.realPeer === "boolean" &&
    "closeRequested" in value &&
    typeof value.closeRequested === "boolean" &&
    "closeRequestedAt" in value &&
    (value.closeRequestedAt === null || typeof value.closeRequestedAt === "number")
  );
}

async function readSessions({ bridge, request }: { bridge: string; request: APIRequestContext }) {
  const response = await request.get(`${bridge}/control/sessions`);
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();

  if (!Array.isArray(body) || !body.every((session: unknown) => isBridgeSession(session))) {
    throw new TypeError("Invalid lane-owned Live provider sessions.");
  }

  return body;
}

async function startNativePeer({ peer, session }: { peer: Page; session: BridgeSession }) {
  return peer.evaluateHandle(
    async ({ id, offer, timeoutMs }) => {
      const pc = new RTCPeerConnection();
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const output = audio.createMediaStreamDestination();
      oscillator.connect(output);
      oscillator.start();
      const canceled = Promise.withResolvers<never>();

      const timer = setTimeout(() => {
        pc.close();
        void audio.close();
        canceled.reject(new Error("Native peer setup exceeded its bounded creation window."));
      }, timeoutMs);

      try {
        await Promise.race([audio.resume(), canceled.promise]);
        const track = output.stream.getAudioTracks()[0];

        if (!track) {
          throw new Error("The native test peer could not create an audio track.");
        }

        pc.addTrack(track, output.stream);
        const state: NativePeer = { audio, channel: null, closeCommands: 0, oscillator, pc };

        pc.addEventListener("datachannel", ({ channel }) => {
          if (channel.label !== "oai-events") {
            throw new Error(`Unexpected Live data channel: ${channel.label}`);
          }

          state.channel = channel;

          channel.addEventListener("open", () =>
            channel.send(JSON.stringify({ session: { id }, type: "session.started" })),
          );

          channel.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
            if (typeof data !== "string") {
              throw new TypeError("The native peer expected a JSON data-channel message.");
            }

            const event: unknown = JSON.parse(data);

            if (!event || typeof event !== "object" || !("type" in event)) {
              throw new TypeError("Invalid Live client event.");
            }

            if (event.type === "session.close") {
              state.closeCommands += 1;
            }

            if (
              event.type === "session.instructions.append" &&
              "content" in event &&
              typeof event.content === "string" &&
              event.content.includes("opening line")
            ) {
              channel.send(
                JSON.stringify({
                  delta: " Hi! Are you calling about the apartment?",
                  end_ms: 800,
                  start_ms: 0,
                  type: "session.output_transcript.delta",
                }),
              );
            }
          });
        });

        await Promise.race([
          pc.setRemoteDescription({ sdp: offer, type: "offer" }),
          canceled.promise,
        ]);

        const gathered = new Promise<void>((resolve) => {
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          });
        });

        const answer = await Promise.race([pc.createAnswer(), canceled.promise]);
        await Promise.race([pc.setLocalDescription(answer), canceled.promise]);

        if (pc.iceGatheringState !== "complete") {
          await Promise.race([gathered, canceled.promise]);
        }

        return state;
      } finally {
        clearTimeout(timer);
      }
    },
    { id: session.id, offer: session.sdp, timeoutMs: NATIVE_SETUP_TIMEOUT_MS },
  );
}

/** Failure teardown records a stopped local fake, never happy-path or OpenAI evidence. */
async function cleanupNativeCall({
  answer,
  bridge,
  conversationId,
  page,
  request,
  session,
}: {
  answer: string | null;
  bridge: string;
  conversationId: string;
  page: Page;
  request: APIRequestContext;
  session: BridgeSession | undefined;
}) {
  if (session?.awaitingAnswer) {
    /** A failed SDP setup must still return the fake's ID so the real core can recover and close it. */
    const response = await request.post(`${bridge}/control/sessions/${session.id}/answer`, {
      data: { sdp: answer ?? TEST_LIVE_SDP_ANSWER },
    });

    expect(response.ok()).toBe(true);

    await expect
      .poll(() => prisma.liveCallConnection.findFirst({ where: { providerSessionId: session.id } }))
      .not.toBeNull();
  }

  const connection = await prisma.liveCallConnection.findFirst({
    where: { conversationId, state: { not: "ended" } },
  });

  if (!connection) {
    return;
  }

  const api = process.env.NEXT_PUBLIC_API_URL;

  if (!api || !["localhost", "127.0.0.1"].includes(new URL(api).hostname)) {
    throw new Error("Native call cleanup requires the lane-owned API origin.");
  }

  await Promise.all([
    (async () => {
      const ended = await page.request.post(
        `${api}/v1/language-conversations/${conversationId}/connections/${connection.id}/end`,
        { data: {}, headers: { Origin: new URL(api).origin } },
      );

      expect(ended.ok()).toBe(true);
    })(),
    (async () => {
      if (!session) {
        return;
      }

      await expect
        .poll(async () => {
          const sessions = await readSessions({ bridge, request });
          return sessions.find((candidate) => candidate.id === session.id)?.closeRequested;
        })
        .toBe(true);
    })(),
  ]);

  await expect
    .poll(() => prisma.liveCallConnection.findUnique({ where: { id: connection.id } }))
    .toMatchObject({ state: "ended" });
}

/** Fixture teardown retains browser/request dependencies and its own budget even when the test times out. */
const test = base.extend<{ liveCallResources: NativeCallResources }>({
  liveCallResources: [
    async ({ browser, request }, use) => {
      const bridge = process.env.LIVE_CALL_TEST_PROVIDER_URL;

      if (!bridge) {
        throw new Error("Run this contract test through the lane's Live provider bridge.");
      }

      const peerContext = await browser.newContext();

      const resources: NativeCallResources = {
        answer: null,
        bridge,
        conversationId: null,
        offer: null,
        page: null,
        peerContext,
      };

      try {
        await use(resources);
      } finally {
        await peerContext.close();
        const { page, conversationId } = resources;

        if (page && conversationId) {
          try {
            const sessions = await readSessions({ bridge, request });

            const session = sessions.find(
              (candidate) => candidate.realPeer && candidate.sdp === resources.offer,
            );

            await cleanupNativeCall({
              answer: resources.answer,
              bridge,
              conversationId,
              page,
              request,
              session,
            });
          } finally {
            await page.context().close();
          }
        }
      }
    },
    { timeout: NATIVE_TEARDOWN_TIMEOUT_MS },
  ],
});

/**
 * A checkpoint call that already connected once: its next connection ends where the first one's
 * call time does, `DEADLINE_MS` from now.
 */
async function reconnectingCheckpoint({ callId, userId }: { callId: string; userId: string }) {
  const now = Date.now();

  return prisma.liveCallConnection.create({
    data: {
      conversationId: callId,
      costMicros: 0,
      createdAt: new Date(now),
      deadlineAt: new Date(now + DEADLINE_MS),
      endedAt: new Date(now),
      heldSeconds: 0,
      state: "ended",
      userId,
    },
  });
}

/** Native browser transport against a local AI fake; this does not establish OpenAI termination semantics. */
test("the durable deadline hangs up an established WebRTC peer when the client never ends", async ({
  browser,
  request,
  liveCallResources: owned,
}) => {
  test.setTimeout(70_000);
  const { bridge, peerContext } = owned;

  const { goal, renting, user } = await createLanguageLearner({ withSubscription: true });

  const call = await prisma.languageConversation.create({
    data: {
      chapterId: renting.id,
      goalId: goal.id,
      kind: "checkpoint",
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes: 1,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });

  const page = await openAs(browser, user);
  owned.page = page;
  owned.conversationId = call.id;
  const sessions = () => readSessions({ bridge, request });

  const offeredSession = async () => {
    const current = await sessions();
    return current.find((session) => session.realPeer && session.sdp === owned.offer);
  };

  const shutdown = { complete: 0, end: 0 };

  page.on("request", (browserRequest) => {
    if (
      browserRequest.method() === "POST" &&
      browserRequest.url().includes(`/conversation/${call.id}/live-session/`)
    ) {
      const body: unknown = browserRequest.postDataJSON();
      owned.offer = getString(body, "sdp");
    }

    if (browserRequest.method() === "POST" && browserRequest.headers()["next-action"]) {
      const args: unknown = JSON.parse(browserRequest.postData() ?? "null");

      if (Array.isArray(args) && args[0] === call.id) {
        const input: unknown = args[1];

        if (typeof input === "string") {
          shutdown.end += 1;
        } else if (
          input &&
          typeof input === "object" &&
          "connectionId" in input &&
          "turns" in input
        ) {
          shutdown.complete += 1;
        }
      }
    }
  });

  const peer = await peerContext.newPage();
  await peer.setContent("<button>Start test peer</button>");
  await peer.getByRole("button", { name: "Start test peer" }).click();
  await page.goto(`/conversation/${call.id}`);
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
  const first = await reconnectingCheckpoint({ callId: call.id, userId: user.id });
  await page.clock.install();
  // A moment ahead: the browser's clock runs from the install, and pausing it behind its time throws.
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole("button", { name: "Start the call" }).click();
  await expect.poll(offeredSession).toBeDefined();
  const session = await offeredSession();

  if (!session) {
    throw new Error("The API did not submit a native SDP offer.");
  }

  const native = await startNativePeer({ peer, session });
  const answer = await native.evaluate(({ pc }) => pc.localDescription?.sdp);
  owned.answer = answer ?? null;
  expect(answer).toContain("a=candidate:");

  const answered = await request.post(`${bridge}/control/sessions/${session.id}/answer`, {
    data: { sdp: answer },
  });

  expect(answered.ok()).toBe(true);

  await expect(
    page
      .getByRole("log", { name: "Conversation" })
      .getByText("Hi! Are you calling about the apartment?"),
  ).toBeVisible();

  await expect.poll(() => native.evaluate(({ pc }) => pc.connectionState)).toBe("connected");
  await expect.poll(() => native.evaluate(({ channel }) => channel?.readyState)).toBe("open");

  await expect
    .poll(() =>
      native.evaluate(async ({ audio, pc }) => {
        const stats = await pc.getStats();

        const hasPackets = (direction: "inbound" | "outbound") =>
          [...stats.values()].some((value: unknown) => {
            if (
              !value ||
              typeof value !== "object" ||
              !("type" in value) ||
              value.type !== `${direction}-rtp` ||
              !("kind" in value) ||
              value.kind !== "audio"
            ) {
              return false;
            }

            const key = direction === "inbound" ? "packetsReceived" : "packetsSent";
            const packets: unknown = Reflect.get(value, key);
            return typeof packets === "number" && packets > 0;
          });

        return {
          audio: audio.state,
          inbound: hasPackets("inbound"),
          outbound: hasPackets("outbound"),
        };
      }),
    )
    .toEqual({ audio: "running", inbound: true, outbound: true });

  const connection = await prisma.liveCallConnection.findFirstOrThrow({
    where: { providerSessionId: session.id },
  });

  expect(connection.state).toBe("live");
  expect(connection.conversationId).toBe(call.id);
  // The whole seconds left of the checkpoint's first window, never past it.
  const underFirst = first.deadlineAt.getTime() - connection.deadlineAt.getTime();
  expect(underFirst).toBeGreaterThanOrEqual(0);
  expect(underFirst).toBeLessThan(1000);

  /** Frozen client timers defeat its countdown. Only the actual server Workflow may hang it up. */
  await expect
    .poll(
      async () => {
        const current = await sessions();
        return current.find((item) => item.id === session.id)?.closeRequested;
      },
      { timeout: DEADLINE_MS + 20_000 },
    )
    .toBe(true);

  const requested = await offeredSession();
  expect(requested?.closeRequestedAt).toBeGreaterThanOrEqual(connection.deadlineAt.getTime());
  const commands = await native.evaluate(({ closeCommands }) => closeCommands);
  expect(commands).toBe(0);
  expect(shutdown).toEqual({ complete: 0, end: 0 });

  // OpenAI ends the session: the browser sees its peer close, without a `session.closed` event.
  await native.evaluate(async ({ audio, oscillator, pc }) => {
    oscillator.stop();
    pc.close();
    await audio.close();
  });

  await expect
    .poll(() => prisma.liveCallConnection.findUnique({ where: { id: connection.id } }))
    .toMatchObject({ endReason: "deadline", state: "ended" });

  const usage = await prisma.usageRecord.findFirstOrThrow({ where: { targetId: connection.id } });
  expect(usage.seconds).toBeLessThanOrEqual(connection.heldSeconds);

  await native.dispose();
});
