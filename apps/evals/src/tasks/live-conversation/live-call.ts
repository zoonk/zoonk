import { getLiveCallModel } from "@zoonk/ai/tasks/language/live-call-provider";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/language/live-conversation-models";
import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";

type LiveCallScript = LanguageConversationSetup["script"];
export type LiveCallCue = LiveCallScript["cues"]["opening"];

const SAMPLE_RATE = 24_000;
const CHUNK_MS = 100;
const MS_PER_SECOND = 1000;
const BYTES_PER_SAMPLE = 2;
const SILENCE = Buffer.alloc((SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_MS) / MS_PER_SECOND);
const START_TIMEOUT_MS = 20_000;
const REPLY_TIMEOUT_MS = 20_000;
const CLOSE_TIMEOUT_MS = 5000;
const POLL_MS = 100;

/** Node's WebSocket (undici) sends headers on the upgrade; the DOM types this app compiles with omit them. */
const NodeWebSocket = WebSocket as unknown as new (
  url: string,
  init: { headers: Record<string, string> },
) => WebSocket;

type CallState = {
  character: string;
  heardUpTo: number;
  lastCharacterAt: number;
  failure: Error | null;
  seconds: number;
  closed: boolean;
  started: boolean;
};

/**
 * What the character said before the cue went out (more of its last turn, while the learner was
 * writing) and after it, once it fell quiet.
 */
type LiveExchange = { before: string; reply: string };

export type LiveCall = {
  send: (cue: LiveCallCue) => void;
  exchange: (cue: LiveCallCue) => Promise<LiveExchange>;
  /** Resolves with the seconds GPT-Live billed. */
  close: () => Promise<number>;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitFor(condition: () => boolean, deadline: number): Promise<boolean> {
  if (condition()) {
    return true;
  }

  if (Date.now() > deadline) {
    return false;
  }

  await sleep(POLL_MS);
  return waitFor(condition, deadline);
}

function onEvent({
  event,
  noBackend,
  send,
  state,
}: {
  event: RealtimeServerEvent;
  noBackend: LiveCallCue;
  send: (cue: LiveCallCue, delegationId: string | null) => void;
  state: CallState;
}) {
  if (event.type === "session-started") {
    state.started = true;
  }

  if (event.type === "transcript-fragment" && event.speaker === "assistant") {
    state.character += event.delta;
    state.lastCharacterAt = Date.now();
  }

  if (event.type === "delegation-created") {
    send(noBackend, event.delegationId);
  }

  if (event.type === "session-usage" || event.type === "session-closed") {
    state.seconds = event.usage.seconds;
    state.closed ||= event.type === "session-closed";
  }

  if (event.type === "error") {
    state.failure = new Error(`GPT-Live error: ${event.code ?? ""} ${event.message}`);
  }
}

/**
 * GPT-Live as the app runs it: the production instructions, the opening cue as the session's
 * developer greeting and client delegation, over the server WebSocket instead of the browser's
 * WebRTC. Silence streams in at real-time pace, as from a quiet microphone, since the model only
 * moves on while input audio arrives.
 */
export async function openLiveCall({
  instructions,
  script,
  targetLanguage,
}: {
  instructions: string;
  script: LiveCallScript;
  targetLanguage: string;
}): Promise<LiveCall> {
  const model = getLiveCallModel();
  const { headers, url } = await model.getServerWebSocketConfig();
  const parse = model.createServerEventParser();
  const socket = new NodeWebSocket(url, { headers });

  const state: CallState = {
    character: "",
    closed: false,
    failure: null,
    heardUpTo: 0,
    lastCharacterAt: 0,
    seconds: 0,
    started: false,
  };

  const sendEvent = (event: Parameters<typeof model.serializeClientEvent>[0]) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(model.serializeClientEvent(event)));
    }
  };

  const send = (cue: LiveCallCue, delegationId: string | null) =>
    sendEvent({
      content: cue.text,
      delegationId,
      providerOptions: { openai: { channel: cue.channel } },
      type: "context-append",
    });

  socket.addEventListener("message", (message) => {
    for (const event of parse(JSON.parse(String(message.data)))) {
      onEvent({ event, noBackend: script.cues.noBackend, send, state });
    }
  });

  socket.addEventListener("close", (event) => {
    state.closed = true;
    state.failure ??= new Error(`The GPT-Live socket closed: ${event.code} ${event.reason}`);
  });

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("The GPT-Live socket failed.")));
  });

  sendEvent({
    config: {
      instructions,
      providerOptions: {
        openai: {
          delegation: { type: "client" },
          input: [
            {
              content: [{ text: script.cues.opening.text, type: "input_text" }],
              role: "developer",
              type: "message",
            },
          ],
          store: false,
        },
      },
      voice: getLiveConversationVoice(targetLanguage),
    },
    type: "session-start",
  });

  const microphone = setInterval(
    () => sendEvent({ audio: SILENCE.toString("base64"), type: "input-audio-append" }),
    CHUNK_MS,
  );

  const check = () => {
    if (state.failure) {
      throw state.failure;
    }
  };

  const isQuiet = () => Date.now() - state.lastCharacterAt >= script.timing.characterQuietMs;

  const takeHeard = () => {
    const heard = state.character.slice(state.heardUpTo).trim();
    state.heardUpTo = state.character.length;
    return heard;
  };

  const close = async () => {
    clearInterval(microphone);
    sendEvent({ type: "session-close" });
    await waitFor(() => state.closed, Date.now() + CLOSE_TIMEOUT_MS);
    socket.close();
    return state.seconds;
  };

  const started = await waitFor(
    () => state.started || state.failure !== null,
    Date.now() + START_TIMEOUT_MS,
  );

  if (!started || state.failure) {
    await close();
    throw state.failure ?? new Error("GPT-Live didn't start the session.");
  }

  return {
    close,
    exchange: async (cue) => {
      await waitFor(() => {
        check();
        return isQuiet();
      }, Date.now() + REPLY_TIMEOUT_MS);

      const before = takeHeard();
      const sentAt = Date.now();
      send(cue, null);

      await waitFor(() => {
        check();
        return state.lastCharacterAt > sentAt && isQuiet();
      }, sentAt + REPLY_TIMEOUT_MS);

      check();
      return { before, reply: takeHeard() };
    },
    send: (cue) => send(cue, null),
  };
}
