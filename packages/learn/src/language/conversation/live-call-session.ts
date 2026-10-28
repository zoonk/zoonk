import { Experimental_OpenAIRealtimeModelLive as OpenAIRealtimeModelLive } from "@ai-sdk/openai";
import {
  Experimental_AbstractRealtimeSession as AbstractRealtimeSession,
  type Experimental_RealtimeServerEvent as RealtimeServerEvent,
  type Experimental_RealtimeSessionOptions as RealtimeSessionOptions,
  type Experimental_RealtimeState as RealtimeState,
} from "ai";

type Listener = () => void;

/** GPT-Live usually starts a session within a second or two. */
const CONNECT_TIMEOUT_MS = 15_000;

/** Only encodes and decodes the call's events: the offer goes to our own route, so the browser never reaches OpenAI. */
const LIVE_EVENTS = new OpenAIRealtimeModelLive("gpt-live-1", {
  baseURL: "",
  headers: () => ({}),
  provider: "openai.live",
});

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

  override dispose() {
    this.listeners.clear();
    super.dispose();
  }
}

/** The call is closed by our server, never from the browser. */
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

/** A hangup at the call's deadline closes the channel without `session.closed`, so a lost connection asks our server how it ended. */
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
