import { type Page } from "@playwright/test";
import { LIVE_CALL_SDP_OFFER } from "@zoonk/testing/fixtures/language";

export const CHARACTER_REPLY = "Yes, it's still available.";
const CHARACTER_CHECK_IN = "Hello? Are you still there?";

/** Its session name marks the fake peer, which the lane's provider bridge answers at once. */
const FAKE_PEER_OFFER = LIVE_CALL_SDP_OFFER.replace("\r\ns=-\r\n", "\r\ns=e2e-browser-peer\r\n");

type PeerMode = "answers" | "silent";

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
  mode: PeerMode;
  reply: string;
  checkIn: string;
}) {
  function createChannel() {
    const channel = {
      bufferedAmount: 0,
      close() {
        channel.readyState = "closed";
      },
      elapsedMs: 0,
      emit(event: object) {
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

function installPeer({ mode, sdp }: { mode: PeerMode; sdp: string }) {
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
    }

    static isObserver(value: unknown): value is () => unknown {
      return typeof value === "function";
    }
    static isFactory(value: unknown): value is () => TestChannel {
      return typeof value === "function";
    }
    static channel() {
      const factory: unknown = Reflect.get(globalThis, "e2eLiveCreateChannel");

      if (!FakePeer.isFactory(factory)) {
        throw new TypeError("Missing browser channel factory");
      }

      return factory();
    }
    connectionState = "new";
    iceConnectionState = "new";
    iceGatheringState = "complete";
    localDescription: RTCSessionDescriptionInit | null = null;
    onconnectionstatechange: (() => void) | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    onicegatheringstatechange: (() => void) | null = null;
    channel = FakePeer.channel();
    sender = {
      replaceTrack: (track: MediaStreamTrack | null) => {
        this.sender.track = track;
        return Promise.resolve();
      },
      track: null as MediaStreamTrack | null,
    };

    addTrack(track: MediaStreamTrack | null = null) {
      this.sender.track = track;
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

      this.connectionState = "connected";
      this.channel.readyState = "open";
      this.onconnectionstatechange?.();
      this.channel.onopen?.();

      queueMicrotask(() => {
        if (mode !== "silent") {
          this.channel.emit({ session: { id: "live_e2e" }, type: "session.started" });
        }
      });

      return Promise.resolve();
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
export async function answerLiveCalls(page: Page, behavior: PeerMode) {
  const asked = Promise.withResolvers<null>();
  await page.exposeFunction("e2eLiveAsked", () => asked.resolve(null));

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
  };
}
