import { type Page } from "@playwright/test";
import { LIVE_CALL_SDP_OFFER } from "@zoonk/testing/fixtures/language";

export const CHARACTER_REPLY = "Yes, it's still available.";
export const CHARACTER_CHECK_IN = "Hello? Are you still there?";
export const CHARACTER_GOODBYE = "Sorry, I have to go. Bye!";

/** GPT-Live answers a cue 0.6 to 1.1 s after it's sent (measured). */
const ANSWER_MS = 600;

/** Its session name marks the fake peer, which the lane's provider bridge answers at once. */
const FAKE_PEER_OFFER = LIVE_CALL_SDP_OFFER.replace("\r\ns=-\r\n", "\r\ns=e2e-browser-peer\r\n");

type PeerMode = "answers" | "silent";

type TestChannel = {
  close: () => void;
  emit: (event: object) => void;
  greeting: string | null;
  onopen: (() => void) | null;
  readyState: string;
};

type PeerLines = { checkIn: string; goodbye: string; reply: string };

function installChannelFactory({
  answerMs,
  lines,
  mode,
}: {
  answerMs: number;
  lines: PeerLines;
  mode: PeerMode;
}) {
  function createChannel() {
    const channel = {
      answer(event: object) {
        setTimeout(() => channel.emit(event), answerMs);
      },
      bufferedAmount: 0,
      close() {
        channel.readyState = "closed";
      },
      elapsedMs: 0,
      emit(event: object) {
        channel.onmessage?.({ data: JSON.stringify(event) });
      },
      /**
       * GPT-Live greets once it has both the server's startup greeting and the app's opening cue
       * (the measured recipe), with the line the server's greeting quotes.
       */
      greet() {
        const quoted = /opening line, (?<line>"(?:[^"\\]|\\.)*")/u.exec(channel.greeting ?? "")
          ?.groups?.line;

        if (quoted && !channel.greeted) {
          channel.greeted = true;
          channel.say(String(JSON.parse(quoted)));
        }
      },
      greeted: false,
      greeting: null as string | null,
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onmessage: null as ((event: { data: string }) => void) | null,
      onopen: null as (() => void) | null,
      readyState: "connecting",
      say(text: string) {
        const start = channel.elapsedMs;
        channel.elapsedMs += 800;

        channel.answer({
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

        if (event.type === "session.commentary.append") {
          channel.answer({
            client_event_id:
              "event_id" in event && typeof event.event_id === "string" ? event.event_id : null,
            end_ms: channel.elapsedMs,
            start_ms: channel.elapsedMs,
            type: "session.commentary.appended",
          });

          if (content.includes("opening line")) {
            channel.greet();
          }

          if (content.includes("still there")) {
            channel.say(lines.checkIn);
          }

          if (content.includes("typed")) {
            channel.say(lines.reply);
          }

          if (content.includes("goodbye") || content.includes("is over")) {
            channel.say(lines.goodbye);
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

    setRemoteDescription(answer: RTCSessionDescriptionInit) {
      const observer: unknown = Reflect.get(globalThis, "e2eLiveAsked");

      if (!FakePeer.isObserver(observer)) {
        throw new Error("Missing test peer observer.");
      }

      observer();

      this.connectionState = "connected";
      this.channel.readyState = "open";
      this.onconnectionstatechange?.();
      this.channel.onopen?.();

      const greeting = /^a=x-e2e-greeting:(?<json>.+)$/mu.exec(answer.sdp ?? "")?.groups?.json;
      this.channel.greeting = greeting ? String(JSON.parse(greeting)) : null;

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

/** A quiet microphone, unless the test installed its own (an own property, in any order). */
function installMicrophone() {
  if (Object.hasOwn(navigator.mediaDevices, "getUserMedia")) {
    return;
  }

  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: () => {
      const context = new AudioContext();
      const silence = context.createConstantSource();
      const output = context.createMediaStreamDestination();
      silence.offset.value = 0;
      silence.connect(output);
      silence.start();
      return Promise.resolve(output.stream);
    },
  });
}

export async function quietMicrophone(page: Page) {
  await page.addInitScript(installMicrophone);
}

/** The browser refuses the microphone, as when the learner blocked it for the site. */
export async function blockMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
    });
  });
}

export async function answerLiveCalls(page: Page, behavior: PeerMode) {
  const asked = Promise.withResolvers<null>();
  await page.exposeFunction("e2eLiveAsked", () => asked.resolve(null));
  await quietMicrophone(page);

  await page.addInitScript(installChannelFactory, {
    answerMs: ANSWER_MS,
    lines: { checkIn: CHARACTER_CHECK_IN, goodbye: CHARACTER_GOODBYE, reply: CHARACTER_REPLY },
    mode: behavior,
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
