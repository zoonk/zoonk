import { type Page } from "@playwright/test";
import { LIVE_CALL_SDP_OFFER } from "@zoonk/testing/fixtures/language";

export const CHARACTER_REPLY = "Yes, it's still available.";
export const CHARACTER_CHECK_IN = "Hello? Are you still there?";
export const CHARACTER_GOODBYE = "Sorry, I have to go. Bye!";
export const CHARACTER_RESUME = "Sorry, we got cut off. Where were we?";

/** GPT-Live answers a cue 0.6 to 1.1 s after it's sent (measured). */
const ANSWER_MS = 600;

/** Its session name marks the fake peer, which the lane's provider bridge answers at once. */
const FAKE_PEER_OFFER = LIVE_CALL_SDP_OFFER.replace("\r\ns=-\r\n", "\r\ns=e2e-browser-peer\r\n");

type PeerMode = "answers" | "silent";

type TestChannel = {
  close: () => void;
  emit: (event: object) => void;
  earlierTurns: number;
  greeting: string | null;
  onclose: (() => void) | null;
  onopen: (() => void) | null;
  readyState: string;
};

type PeerLines = { checkIn: string; goodbye: string; reply: string; resume: string };

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
      earlierTurns: 0,
      elapsedMs: 0,
      emit(event: object) {
        channel.onmessage?.({ data: JSON.stringify(event) });
      },
      /**
       * GPT-Live greets once it has both the server's startup greeting and the app's opening cue
       * (the measured recipe), with the line the server's greeting quotes; a call that dropped
       * carries on instead, when its earlier turns reached the session.
       */
      greet() {
        const greeting = channel.greeting ?? "";
        const quoted = /opening line, (?<line>"(?:[^"\\]|\\.)*")/u.exec(greeting)?.groups?.line;

        if (!quoted || channel.greeted) {
          return;
        }

        channel.greeted = true;
        const resumed = greeting.includes("cut off") && channel.earlierTurns > 0;
        channel.say(resumed ? lines.resume : String(JSON.parse(quoted)));
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

    /** The network lost the call: its data channel closes without the provider ending it. */
    private readonly drop = () => {
      this.channel.readyState = "closed";
      this.channel.onclose?.();
    };

    constructor() {
      globalThis.addEventListener("e2e-live-server-event", this.receive);
      globalThis.addEventListener("e2e-live-drop", this.drop);
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

      this.channel.earlierTurns = Number(
        /^a=x-e2e-turns:(?<count>\d+)$/mu.exec(answer.sdp ?? "")?.groups?.count ?? 0,
      );

      queueMicrotask(() => {
        if (mode !== "silent") {
          this.channel.emit({ session: { id: "live_e2e" }, type: "session.started" });
        }
      });

      return Promise.resolve();
    }

    close() {
      globalThis.removeEventListener("e2e-live-server-event", this.receive);
      globalThis.removeEventListener("e2e-live-drop", this.drop);
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
    lines: {
      checkIn: CHARACTER_CHECK_IN,
      goodbye: CHARACTER_GOODBYE,
      reply: CHARACTER_REPLY,
      resume: CHARACTER_RESUME,
    },
    mode: behavior,
  });

  await page.addInitScript(installPeer, { mode: behavior, sdp: FAKE_PEER_OFFER });

  return {
    asked: asked.promise,
    drop: () => page.evaluate(() => globalThis.dispatchEvent(new Event("e2e-live-drop"))),
    emit: (event: object) =>
      page.evaluate((data) => {
        globalThis.dispatchEvent(new CustomEvent("e2e-live-server-event", { detail: data }));
      }, event),
  };
}
