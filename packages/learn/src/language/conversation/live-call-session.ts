import { Experimental_OpenAIRealtimeModelLive as OpenAIRealtimeModelLive } from "@ai-sdk/openai";
import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import {
  Experimental_AbstractRealtimeSession as AbstractRealtimeSession,
  type Experimental_RealtimeServerEvent as RealtimeServerEvent,
  type Experimental_RealtimeSessionOptions as RealtimeSessionOptions,
  type Experimental_RealtimeState as RealtimeState,
} from "ai";

type Listener = () => void;

/** GPT-Live's only WebSocket format in the browser: PCM16, the same both ways. */
const PCM_24K = { rate: 24_000, type: "audio/pcm" } as const;

/** GPT-Live confirms the session's final usage within about five seconds of `session.close`. */
const CLOSE_TIMEOUT_MS = 5000;

/**
 * The AI SDK's realtime session with a store React can subscribe to: the session calls
 * `setState` whenever its status, audio state or Live session state change, and subscribers
 * re-read it.
 */
export class LiveCallSession extends AbstractRealtimeSession {
  private readonly listeners = new Set<Listener>();
  private snapshot: RealtimeState;

  constructor(options: RealtimeSessionOptions) {
    super(options);
    this.snapshot = { ...this.state };
  }

  protected setState<TKey extends keyof RealtimeState>(key: TKey, value: RealtimeState[TKey]) {
    this.snapshot = { ...this.snapshot, [key]: value };

    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RealtimeState => this.snapshot;
}

/**
 * A call on GPT-Live's native Live protocol through AI Gateway: the AI SDK's session streams the
 * microphone as PCM16 at 24 kHz, plays the audio back, and closes gracefully for the final usage.
 * The browser opens the WebSocket itself with the token in its subprotocols, and the codec sends
 * `session.start` with the conversation's instructions and client delegation, the only kind the
 * gateway supports.
 */
export function createLiveCallSession({
  instructions,
  onError,
  onEvent,
  setup,
}: {
  instructions: string;
  onError: (error: Error) => void;
  onEvent: (event: RealtimeServerEvent) => void;
  setup: LanguageConversationSetup;
}): LiveCallSession {
  return new LiveCallSession({
    api: { protocols: setup.protocols, websocket: setup.url },
    closeTimeoutMs: CLOSE_TIMEOUT_MS,
    // Only the Live event codec runs in the browser; the gateway URL and token come from setup.
    model: new OpenAIRealtimeModelLive(setup.model, {
      baseURL: setup.url,
      headers: () => ({}),
      provider: "gateway.live",
    }),
    onError,
    onEvent,
    sessionConfig: {
      inputAudioFormat: PCM_24K,
      instructions,
      outputAudioFormat: PCM_24K,
      providerOptions: { openai: { delegation: { type: "client" }, store: false } },
      voice: setup.voice,
    },
  });
}

/**
 * Tells GPT-Live something during the call. `instructions` makes it act now; `thinking` only adds
 * context. A cue that can't be delivered, because the call is closing, is dropped.
 */
export function sendLiveCallCue({
  channel = "instructions",
  content,
  delegationId = null,
  session,
}: {
  channel?: "instructions" | "thinking";
  content: string;
  delegationId?: string | null;
  session: LiveCallSession;
}) {
  try {
    void session
      .sendEvent({
        content,
        delegationId,
        providerOptions: { openai: { channel } },
        type: "context-append",
      })
      .catch(() => null);
  } catch {
    // The session stopped accepting cues: the call is ending.
  }
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * The learner's microphone, or silence when it's blocked. A GPT-Live session only moves on while
 * audio streams in, so a call the learner types in still sends silence.
 */
export async function openCallAudio(): Promise<{
  blocked: boolean;
  stop: () => void;
  stream: MediaStream;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { blocked: false, stop: () => stopTracks(stream), stream };
  } catch {
    const context = new AudioContext();
    const silence = context.createConstantSource();
    const destination = context.createMediaStreamDestination();
    silence.offset.value = 0;
    silence.connect(destination);
    silence.start();

    return {
      blocked: true,
      stop: () => {
        stopTracks(destination.stream);
        void context.close();
      },
      stream: destination.stream,
    };
  }
}
