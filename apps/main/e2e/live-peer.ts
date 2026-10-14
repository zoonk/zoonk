import { type Page } from "@playwright/test";
import { LIVE_CALL_SDP_OFFER } from "@zoonk/testing/fixtures/language";

export const CHARACTER_REPLY = "Yes, it's still available.";
export const CHARACTER_CHECK_IN = "Hello? Are you still there?";

/** Its session name marks the fake peer, which the lane's provider bridge answers at once. */
const FAKE_PEER_OFFER = LIVE_CALL_SDP_OFFER.replace("\r\ns=-\r\n", "\r\ns=e2e-browser-peer\r\n");

/** Platform controls keep the actual broker and server reservation untouched. */
function installPeerControls({ holdAnswer }: { holdAnswer: boolean }) {
  const controls = {
    elements: new Set<HTMLMediaElement>(),
    observe(element: HTMLMediaElement) {
      if (!controls.elements.has(element)) {
        controls.elements.add(element);

        element.addEventListener("playing", () => {
          controls.playingEvents += 1;
        });
      }
    },
    pending: [] as ((stream?: MediaStream) => void)[],
    playingEvents: 0,
    snapshots: [] as (() => unknown)[],
  };

  const originalPlay: unknown = Reflect.get(HTMLMediaElement.prototype, "play");
  const originalPause: unknown = Reflect.get(HTMLMediaElement.prototype, "pause");

  const guards = {
    isApply(value: unknown): value is (stream?: MediaStream) => void {
      return typeof value === "function";
    },
    isPause(value: unknown): value is (this: HTMLMediaElement) => void {
      return typeof value === "function";
    },
    isPlay(value: unknown): value is (this: HTMLMediaElement) => Promise<void> {
      return typeof value === "function";
    },
    isSnapshot(value: unknown): value is () => unknown {
      return typeof value === "function";
    },
  };

  if (!guards.isPlay(originalPlay) || !guards.isPause(originalPause)) {
    throw new TypeError("Missing browser media methods");
  }

  HTMLMediaElement.prototype.play = function play() {
    controls.observe(this);
    return originalPlay.call(this);
  };

  HTMLMediaElement.prototype.pause = function pause() {
    controls.observe(this);
    originalPause.call(this);
  };

  globalThis.addEventListener("e2e-live-remote", (event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const apply: unknown = event.detail;

    if (!guards.isApply(apply)) {
      throw new TypeError("Invalid platform answer control.");
    }

    if (holdAnswer) {
      controls.pending.push(apply);
    } else {
      apply();
    }
  });

  globalThis.addEventListener("e2e-live-peer-snapshot", (event) => {
    if (event instanceof CustomEvent && guards.isSnapshot(event.detail)) {
      controls.snapshots.push(event.detail);
    }
  });

  const applyAnswers = async () => {
    const context = new AudioContext();
    const source = context.createConstantSource();
    const output = context.createMediaStreamDestination();
    source.offset.value = 0;
    source.connect(output);
    source.start();
    await context.resume();

    for (const apply of controls.pending.splice(0)) {
      apply(output.stream);
    }
  };

  const snapshot = () => ({
    mediaPaused: [...controls.elements].map((element) => element.paused),
    peers: controls.snapshots.map((read) => read()),
    pendingAnswers: controls.pending.length,
    playingEvents: controls.playingEvents,
  });

  Object.assign(globalThis, { e2eLiveApplyAnswers: applyAnswers, e2eLivePeerSnapshot: snapshot });
}

type TestChannel = {
  close: () => void;
  emit: (event: object) => void;
  onopen: (() => void) | null;
  readyState: string;
};

function installChannelFactory({
  mode,
  reply,
  checkIn,
}: {
  mode: "answers" | "drops" | "silent";
  reply: string;
  checkIn: string;
}) {
  function createChannel(drop: () => void) {
    const channel = {
      bufferedAmount: 0,
      close() {
        channel.readyState = "closed";
      },
      elapsedMs: 0,
      emit(event: object) {
        if (
          "type" in event &&
          event.type === "session.started" &&
          !Object.hasOwn(globalThis, "e2eLiveStartedAt")
        ) {
          Object.defineProperty(globalThis, "e2eLiveStartedAt", { value: Date.now() });
        }

        channel.onmessage?.({ data: JSON.stringify(event) });
      },
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onmessage: null as ((event: { data: string }) => void) | null,
      onopen: null as (() => void) | null,
      readyState: "connecting",
      say(text: string) {
        const start = channel.elapsedMs;
        channel.elapsedMs += 800;

        channel.emit({
          delta: ` ${text}`,
          end_ms: channel.elapsedMs,
          start_ms: start,
          type: "session.output_transcript.delta",
        });
      },
      send(data: string) {
        const event: unknown = JSON.parse(data);

        if (!event || typeof event !== "object" || !("type" in event) || mode === "silent") {
          return;
        }

        const content =
          "content" in event && typeof event.content === "string" ? event.content : "";

        if (event.type === "session.instructions.append") {
          if (content.includes("opening line")) {
            channel.say("Hi! Are you calling about the apartment?");
          }

          if (content.includes("quiet")) {
            channel.say(checkIn);
          }

          if (content.includes("typed")) {
            channel.say(reply);

            if (mode === "drops") {
              drop();
            }
          }
        }

        if (event.type === "session.close") {
          throw new Error("The browser must close through the real server End action.");
        }
      },
    };

    return channel;
  }

  Object.assign(globalThis, { e2eLiveCreateChannel: createChannel });
}

function installPeer({ mode, sdp }: { mode: "answers" | "drops" | "silent"; sdp: string }) {
  class FakePeer {
    private readonly receive = (event: Event) => {
      if (event instanceof CustomEvent) {
        const data: unknown = event.detail;

        if (data && typeof data === "object") {
          this.channel.emit(data);
        }
      }
    };

    constructor() {
      globalThis.addEventListener("e2e-live-server-event", this.receive);

      globalThis.dispatchEvent(
        new CustomEvent("e2e-live-peer-snapshot", {
          detail: () => ({
            capture: this.captureTrack?.readyState ?? null,
            connection: this.connectionState,
            track: this.sender.track?.readyState ?? null,
          }),
        }),
      );
    }

    static isObserver(value: unknown): value is () => unknown {
      return typeof value === "function";
    }
    static isFactory(value: unknown): value is (drop: () => void) => TestChannel {
      return typeof value === "function";
    }
    static channel(drop: () => void) {
      const factory: unknown = Reflect.get(globalThis, "e2eLiveCreateChannel");

      if (!FakePeer.isFactory(factory)) {
        throw new TypeError("Missing browser channel factory");
      }

      return factory(drop);
    }
    captureTrack: MediaStreamTrack | null = null;
    connectionState = "new";
    iceConnectionState = "new";
    iceGatheringState = "complete";
    localDescription: RTCSessionDescriptionInit | null = null;
    onconnectionstatechange: (() => void) | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    onicegatheringstatechange: (() => void) | null = null;
    ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
    channel = FakePeer.channel(() => {
      this.connectionState = "failed";
      this.onconnectionstatechange?.();
    });
    sender = {
      replaceTrack: (track: MediaStreamTrack | null) => {
        this.sender.track = track;
        return Promise.resolve();
      },
      track: null as MediaStreamTrack | null,
    };

    addTrack(track: MediaStreamTrack | null = null) {
      this.sender.track = track;
      this.captureTrack = track;
      return this.sender;
    }
    offer = { sdp, type: "offer" };
    createOffer = () => Promise.resolve(this.offer);

    createDataChannel() {
      return this.channel;
    }

    addTransceiver() {
      return { sender: this.addTrack() };
    }

    setLocalDescription(description: RTCSessionDescriptionInit) {
      this.localDescription = description;
      return Promise.resolve();
    }

    setRemoteDescription() {
      const observer: unknown = Reflect.get(globalThis, "e2eLiveAsked");

      if (!FakePeer.isObserver(observer)) {
        throw new Error("Missing test peer observer.");
      }

      observer();

      return new Promise<void>((resolve) => {
        const apply = (stream?: MediaStream) => {
          if (stream) {
            const track = stream.getAudioTracks()[0];

            if (!track) {
              throw new Error("The late platform track is missing.");
            }

            this.ontrack?.({ streams: [stream], track });
          }

          this.connectionState = "connected";
          this.channel.readyState = "open";
          this.onconnectionstatechange?.();
          this.channel.onopen?.();
          resolve();

          queueMicrotask(() => {
            if (mode !== "silent") {
              this.channel.emit({ session: { id: "live_e2e" }, type: "session.started" });
            }
          });
        };

        globalThis.dispatchEvent(new CustomEvent("e2e-live-remote", { detail: apply }));
      });
    }

    close() {
      globalThis.removeEventListener("e2e-live-server-event", this.receive);
      this.connectionState = "closed";
      this.channel.close();
    }
  }

  Object.defineProperty(globalThis, "RTCPeerConnection", { configurable: true, value: FakePeer });
}

/** Broad UI coverage fakes only the browser media peer; SDP still reaches the product broker. */
export async function answerLiveCalls(
  page: Page,
  behavior: "answers" | "drops" | "silent",
  { holdAnswer = false }: { holdAnswer?: boolean } = {},
) {
  const asked = Promise.withResolvers<null>();
  await page.exposeFunction("e2eLiveAsked", () => asked.resolve(null));

  await page.addInitScript(installPeerControls, { holdAnswer });

  await page.addInitScript(installChannelFactory, {
    checkIn: CHARACTER_CHECK_IN,
    mode: behavior,
    reply: CHARACTER_REPLY,
  });

  await page.addInitScript(installPeer, { mode: behavior, sdp: FAKE_PEER_OFFER });

  return {
    asked: asked.promise,
    emit: (event: object) =>
      page.evaluate((data) => {
        globalThis.dispatchEvent(new CustomEvent("e2e-live-server-event", { detail: data }));
      }, event),
    getStartedAt: (): Promise<number | null> =>
      page.evaluate(() => {
        const startedAt: unknown = Reflect.get(globalThis, "e2eLiveStartedAt");
        return typeof startedAt === "number" && Number.isFinite(startedAt) ? startedAt : null;
      }),
  };
}
