import { Experimental_OpenAIRealtimeModelLive as OpenAIRealtimeModelLive } from "@ai-sdk/openai";
import {
  Experimental_AbstractRealtimeSession as AbstractRealtimeSession,
  type Experimental_RealtimeServerEvent as RealtimeServerEvent,
  type Experimental_RealtimeSessionOptions as RealtimeSessionOptions,
  type Experimental_RealtimeState as RealtimeState,
} from "ai";

type Listener = () => void;

/**
 * GPT-Live usually starts a session within a second or two. One that hasn't started after this
 * isn't going to, so the call says it didn't connect and offers another try instead of ringing.
 */
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * GPT-Live's events, read and written in the browser. Our server creates each session with its
 * model, instructions, voice and allowed events, so the browser never reaches OpenAI itself: the
 * offer goes to our own route, and this model only encodes and decodes the call's events.
 */
const LIVE_EVENTS = new OpenAIRealtimeModelLive("gpt-live-1", {
  baseURL: "",
  headers: () => ({}),
  provider: "openai.live",
});

/**
 * The AI SDK's realtime session with a store React can subscribe to: the session calls
 * `setState` whenever its status, audio state or Live session state change, and subscribers
 * re-read it. A call silenced on this side (`silence`) stays silent while its peer waits for the
 * server to close it.
 */
export class LiveCallSession extends AbstractRealtimeSession {
  private readonly listeners = new Set<Listener>();
  private snapshot: RealtimeState;
  private silenced = false;

  constructor(options: RealtimeSessionOptions) {
    super(options);
    this.snapshot = { ...this.state };
  }

  protected setState<TKey extends keyof RealtimeState>(key: TKey, value: RealtimeState[TKey]) {
    this.snapshot = { ...this.snapshot, [key]: value };

    // The SDK plays the character's track whenever it arrives, even after the call was silenced
    // (an answer still on its way when the learner ended or left): it's paused again at once.
    if (this.silenced && key === "isPlaying" && value === true) {
      this.stopPlayback();
    }

    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Silences the call on this side for good when it ends: the learner's audio stops going out and
   * the character's stops playing, now and if its track only arrives later, while our server
   * closes the session. The peer stays until the server confirms.
   */
  silence() {
    this.silenced = true;
    this.stopAudioCapture();
    this.stopPlayback();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RealtimeState => this.snapshot;

  /** A disposed call is over for good: whoever listened stops hearing about it as it closes. */
  override dispose() {
    this.listeners.clear();
    super.dispose();
  }
}

/**
 * A call on GPT-Live over WebRTC, its session created by our server: the AI SDK posts the
 * browser's offer to `sessionUrl`, our same-origin route, and connects with the answer it returns.
 * The microphone (or silence) goes out as the call's audio track, and the character's voice plays
 * back as media. The call is closed by our server, never from the browser.
 */
export function createLiveCallSession({
  onEvent,
  sessionUrl,
}: {
  onEvent: (event: RealtimeServerEvent) => void;
  sessionUrl: string;
}): LiveCallSession {
  return new LiveCallSession({
    api: { session: sessionUrl },
    model: LIVE_EVENTS,
    onEvent,
    startupTimeoutMs: CONNECT_TIMEOUT_MS,
  });
}

/**
 * Follows an open call's connection. One lost without GPT-Live confirming the end (it never
 * started in time, failed, or closed) asks our server how it ended (`endedByServer`): a hangup at
 * the call's deadline closes the browser's channel without `session.closed`, and that call ended
 * normally (`onEnded`); anything else lost it (`onLost`). A cue GPT-Live rejected doesn't count.
 * Disposing the session stops the watch.
 */
export function watchConnection({
  endedByServer,
  isOpen,
  onEnded,
  onLost,
  session,
}: {
  endedByServer: () => Promise<boolean>;
  isOpen: () => boolean;
  onEnded: () => void;
  onLost: () => void;
  session: LiveCallSession;
}) {
  const lost = { asked: false };

  session.subscribe(() => {
    const { session: live, status } = session.getSnapshot();
    const closedUnconfirmed = status === "disconnected" && live?.finalization !== "confirmed";

    if ((status !== "error" && !closedUnconfirmed) || !isOpen() || lost.asked) {
      return;
    }

    lost.asked = true;

    void endedByServer().then(
      (ended) => (ended ? onEnded() : onLost()),
      () => onLost(),
    );
  });
}
