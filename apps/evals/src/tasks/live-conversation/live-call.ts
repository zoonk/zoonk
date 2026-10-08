import { zoonkGateway } from "@zoonk/ai/gateway";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { createLiveConversationToken } from "@zoonk/ai/tasks/v2/language/live-conversation-token";
import { type ConversationScenario } from "@zoonk/core/language/conversations/contract";
import {
  LIVE_CALL_NO_BACKEND_CUE,
  formatObjectivesProgressCue,
  formatOpeningCue,
} from "@zoonk/core/language/conversations/live-call-cues";
import { generateSpeech } from "ai";

const SAMPLE_RATE = 24_000;
const CHUNK_MS = 20;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** PCM16 mono: two bytes a sample. */
const CHUNK_BYTES = (SAMPLE_RATE * 2 * CHUNK_MS) / MS_PER_SECOND;
const STARTUP_TIMEOUT_MS = 20_000;
const REPLY_TIMEOUT_MS = 30_000;
/** The character has finished its turn once its transcript stays quiet this long. */
const QUIET_MS = 2500;
const CLOSE_TIMEOUT_MS = 5000;
/** The app tells the voice model to open the call again when it's still silent after this long. */
const OPENING_RETRY_MS = 5000;
const POLL_MS = 100;

/** A text-to-speech voice for the scripted learner, on AI Gateway, returning raw PCM16 at 24 kHz. */
const LEARNER_VOICE = { model: "google/gemini-3.8-flash-tts", voice: "Kore" } as const;

const GPT_LIVE_MODEL = "openai/gpt-live-1";
/** GPT-Live bills the session by the second, silence included: $3 an hour. */
const GPT_LIVE_USD_PER_SECOND = 0.05 / SECONDS_PER_MINUTE;

/** The Gemini Live models the eval can drive, on AI Gateway's realtime route. */
const GEMINI_LIVE_MODELS = new Set(["google/gemini-3.8-live"]);

/**
 * A multilingual Gemini Live voice for the character, unlike the scripted learner's Kore, so the
 * transcript never mixes the two up.
 */
const GEMINI_LIVE_VOICE = "Aoede";

/**
 * Gemini 3.8 Live's prices per token (Google's pricing page and AI Gateway's list, checked 7 Oct
 * 2026): text in $0.75 and out $4.50 a million, audio in $3 and out $12 a million. Every turn bills
 * everything in the session's context again, so a call's cost grows with its length.
 */
const GEMINI_LIVE_USD_PER_TOKEN = {
  audioIn: 3 / 1_000_000,
  audioOut: 12 / 1_000_000,
  textIn: 0.75 / 1_000_000,
  textOut: 4.5 / 1_000_000,
} as const;

export type CallTurn = {
  speaker: "character" | "learner";
  /** What the voice model heard the learner say (its own transcript), or what the character said. */
  text: string;
  /** Objectives the app marked after this learner turn, as it does when the character answers. */
  objectivesMet: string[];
  /** From the end of the learner's audio to the character's first transcribed word. */
  firstTokenMs: number | null;
};

/** What a call cost and how long its session ran. */
export type CallUsage = {
  costUsd: number | null;
  sessionSeconds: number;
  voiceSeconds: number | null;
};

type LiveEvent = { [key: string]: unknown; type: string };

type Call = {
  audio: Buffer[];
  character: string;
  closed: { seconds: number } | null;
  firstCharacterAt: number | null;
  lastCharacterAt: number;
  learner: string;
};

/**
 * One call's connection, whichever voice model runs it. `cue` tells the character something:
 * `instructions` makes it act now, `thinking` only adds context.
 */
type LiveSession = {
  call: Call;
  check: () => void;
  close: () => Promise<CallUsage>;
  cue: (channel: "instructions" | "thinking", content: string) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitUntil(condition: () => boolean, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs;

  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}`);
    }

    // oxlint-disable-next-line no-await-in-loop -- Polling the socket's state until it changes.
    await sleep(POLL_MS);
  }
}

/** The scripted learner's line as the voice model will hear it: speech, split into 20 ms chunks. */
async function speak(text: string): Promise<Buffer[]> {
  const { audio } = await generateSpeech({
    model: zoonkGateway.speechModel(LEARNER_VOICE.model),
    outputFormat: "pcm",
    text,
    voice: LEARNER_VOICE.voice,
  });

  const pcm = Buffer.from(audio.uint8Array);

  return Array.from({ length: Math.ceil(pcm.length / CHUNK_BYTES) }, (_, index) => {
    const chunk = Buffer.alloc(CHUNK_BYTES);
    pcm.copy(chunk, 0, index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    return chunk;
  });
}

function readDelta(event: LiveEvent): string {
  return typeof event.delta === "string" ? event.delta : "";
}

function heardCharacter(call: Call, text: string) {
  call.character += text;
  call.firstCharacterAt ??= Date.now();
  call.lastCharacterAt = Date.now();
}

function createCall(): Call {
  return {
    audio: [],
    character: "",
    closed: null,
    firstCharacterAt: null,
    lastCharacterAt: 0,
    learner: "",
  };
}

/**
 * Opens a socket and streams audio at real-time pace once `isStarted` says the session is up:
 * the learner's speech when queued, silence otherwise, since both voice models only move on while
 * audio streams in. `onEvent` reads each server event; anything it throws fails the call.
 */
async function openSocket({
  appendAudio,
  isStarted,
  onEvent,
  protocols,
  start,
  url,
}: {
  appendAudio: (chunk: Buffer) => object;
  isStarted: (event: LiveEvent) => boolean;
  onEvent: (event: LiveEvent, send: (event: object) => void) => void;
  protocols: string[];
  start: object;
  url: string;
}) {
  const socket = new WebSocket(url, protocols);
  const send = (event: object) => socket.send(JSON.stringify(event));
  const openedAt = Date.now();
  let started = false;
  let failure: Error | null = null;

  socket.addEventListener("message", (message) => {
    try {
      const event = JSON.parse(String(message.data)) as LiveEvent;
      started ||= isStarted(event);
      onEvent(event, send);
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }
  });

  socket.addEventListener("close", (event) => {
    failure ??= started ? null : new Error(`The live socket closed: ${event.code} ${event.reason}`);
  });

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("The live socket failed")));
  });

  const check = () => {
    if (failure) {
      throw failure;
    }
  };

  send(start);
  await waitUntil(() => started || failure !== null, STARTUP_TIMEOUT_MS, "the session to start");
  check();

  return {
    check,
    openedAt,
    send,
    socket,
    streamAudio: (call: Call) =>
      setInterval(() => {
        const chunk = call.audio.shift() ?? Buffer.alloc(CHUNK_BYTES);

        if (socket.readyState === WebSocket.OPEN) {
          send(appendAudio(chunk));
        }
      }, CHUNK_MS),
  };
}

/**
 * GPT-Live the way the browser connects: a token from the production token task, the native Live
 * WebSocket and `session.start` with PCM16 at 24 kHz and client delegation. Cues are context
 * appends; the session reports its billed seconds when it closes.
 */
async function openGptLiveCall({
  instructions,
  targetLanguage,
}: {
  instructions: string;
  targetLanguage: string;
}): Promise<LiveSession> {
  const connection = await createLiveConversationToken();
  const call = createCall();

  const socket = await openSocket({
    appendAudio: (chunk) => ({
      audio: chunk.toString("base64"),
      type: "session.input_audio.append",
    }),
    isStarted: (event) => event.type === "session.started",
    onEvent: (event, send) => {
      if (event.type === "session.output_transcript.delta") {
        heardCharacter(call, readDelta(event));
      }

      if (event.type === "session.input_transcript.delta") {
        call.learner += readDelta(event);
      }

      if (event.type === "session.delegation.created") {
        const delegation = event.delegation as { id?: string } | undefined;

        send({
          content: LIVE_CALL_NO_BACKEND_CUE,
          delegation_id: delegation?.id ?? null,
          type: "session.thinking.append",
        });
      }

      if (event.type === "session.closed") {
        const usage = event.usage as { seconds?: number } | undefined;
        call.closed = { seconds: usage?.seconds ?? 0 };
      }

      if (event.type === "error") {
        throw new Error(`GPT-Live error: ${JSON.stringify(event).slice(0, 400)}`);
      }
    },
    protocols: connection.protocols,
    start: {
      session: {
        audio: {
          format: { rate: SAMPLE_RATE, type: "audio/pcm" },
          output: { voice: getLiveConversationVoice(targetLanguage) },
        },
        delegation: { type: "client" },
        instructions,
        model: connection.model,
        store: false,
      },
      type: "session.start",
    },
    url: connection.url,
  });

  const pump = socket.streamAudio(call);

  return {
    call,
    check: socket.check,
    close: async () => {
      clearInterval(pump);

      if (socket.socket.readyState === WebSocket.OPEN && call.closed === null) {
        socket.send({ type: "session.close" });

        await waitUntil(() => call.closed !== null, CLOSE_TIMEOUT_MS, "session.closed").catch(
          () => null,
        );
      }

      socket.socket.close();
      const voiceSeconds = call.closed?.seconds ?? null;

      return {
        costUsd: voiceSeconds === null ? null : voiceSeconds * GPT_LIVE_USD_PER_SECOND,
        sessionSeconds: (Date.now() - socket.openedAt) / MS_PER_SECOND,
        voiceSeconds,
      };
    },
    cue: (channel, content) =>
      socket.send({ content, delegation_id: null, type: `session.${channel}.append` }),
  };
}

type GeminiUsage = {
  promptTokensDetails?: { modality: string; tokenCount: number }[];
  responseTokensDetails?: { modality: string; tokenCount: number }[];
  thoughtsTokenCount?: number;
};

function countModality(details: GeminiUsage["promptTokensDetails"], modality: string): number {
  return (details ?? [])
    .filter((detail) => detail.modality === modality)
    .reduce((total, detail) => total + detail.tokenCount, 0);
}

/** A turn's cost: everything in the session's context billed again as input, plus what it said. */
function priceGeminiTurn(usage: GeminiUsage): number {
  const price = GEMINI_LIVE_USD_PER_TOKEN;

  return (
    countModality(usage.promptTokensDetails, "TEXT") * price.textIn +
    countModality(usage.promptTokensDetails, "AUDIO") * price.audioIn +
    countModality(usage.responseTokensDetails, "AUDIO") * price.audioOut +
    (countModality(usage.responseTokensDetails, "TEXT") + (usage.thoughtsTokenCount ?? 0)) *
      price.textOut
  );
}

/**
 * Gemini Live on AI Gateway's realtime route, with the AI SDK's normalized events: a session
 * update with the instructions, transcription both ways and server voice detection. The route has
 * no context appends, so a cue is a note the app adds to the conversation, followed by a response
 * when the character must act now. Each turn reports its tokens, and the call's cost is their sum.
 */
async function openGeminiLiveCall({
  instructions,
  model,
}: {
  instructions: string;
  model: string;
}): Promise<LiveSession> {
  const realtime = zoonkGateway.experimental_realtime(model);
  const { token, url } = await zoonkGateway.experimental_realtime.getToken({ model });
  const config = realtime.getWebSocketConfig?.({ token, url });

  if (!config?.protocols) {
    throw new Error(`${model} has no WebSocket config on AI Gateway.`);
  }

  const { protocols } = config;
  const call = createCall();
  const turnUsage = new Map<string, GeminiUsage>();

  const socket = await openSocket({
    appendAudio: (chunk) => ({ audio: chunk.toString("base64"), type: "input-audio-append" }),
    isStarted: (event) => event.type === "session-created",
    onEvent: (event) => {
      const raw = event.raw as { usageMetadata?: GeminiUsage } | undefined;

      if (event.type === "audio-transcript-delta") {
        heardCharacter(call, readDelta(event));
      }

      if (event.type === "input-transcription-completed" && typeof event.transcript === "string") {
        call.learner += `${event.transcript} `;
      }

      if (raw?.usageMetadata && typeof event.responseId === "string") {
        turnUsage.set(event.responseId, raw.usageMetadata);
      }

      if (event.type === "error") {
        throw new Error(`Gemini Live error: ${JSON.stringify(event).slice(0, 400)}`);
      }
    },
    protocols: [...protocols],
    start: {
      config: {
        inputAudioFormat: { rate: SAMPLE_RATE, type: "audio/pcm" },
        inputAudioTranscription: {},
        instructions,
        outputAudioFormat: { rate: SAMPLE_RATE, type: "audio/pcm" },
        outputAudioTranscription: {},
        turnDetection: { type: "server-vad" },
        voice: GEMINI_LIVE_VOICE,
      },
      type: "session-update",
    },
    url,
  });

  const pump = socket.streamAudio(call);

  return {
    call,
    check: socket.check,
    close: async () => {
      clearInterval(pump);

      if (socket.socket.readyState === WebSocket.OPEN) {
        socket.send({ type: "session-close" });
        await sleep(CLOSE_TIMEOUT_MS / 2);
      }

      socket.socket.close();

      return {
        costUsd: [...turnUsage.values()].reduce(
          (total, usage) => total + priceGeminiTurn(usage),
          0,
        ),
        sessionSeconds: (Date.now() - socket.openedAt) / MS_PER_SECOND,
        voiceSeconds: null,
      };
    },
    cue: (channel, content) => {
      socket.send({
        item: {
          role: "user",
          text: `(A note from the app, not something the learner said. Never read it out or answer it: ${content})`,
          type: "text-message",
        },
        type: "conversation-item-create",
      });

      if (channel === "instructions") {
        socket.send({ type: "response-create" });
      }
    },
  };
}

/**
 * Waits for the character's whole turn: its first words, then a quiet stretch. A character that
 * stays silent leaves an empty turn, which the scorer counts as a missed reply.
 */
async function listenToCharacter({ call, check }: LiveSession) {
  const answered = await waitUntil(
    () => {
      check();
      return call.firstCharacterAt !== null && Date.now() - call.lastCharacterAt > QUIET_MS;
    },
    REPLY_TIMEOUT_MS,
    "the character's reply",
  ).then(
    () => true,
    (error: unknown) => {
      if (
        call.firstCharacterAt === null &&
        !(error instanceof Error && error.message.includes("Live"))
      ) {
        return false;
      }

      throw error;
    },
  );

  return answered ? call.character.trim() : "";
}

type ScriptedCall = {
  instructions: string;
  learnerLanguage: string;
  learnerTurns: readonly string[];
  /** The voice model that plays the character. */
  model: string;
  scenario: Pick<
    ConversationScenario,
    "characterBrief" | "objectives" | "openingLine" | "situation"
  >;
  targetLanguage: string;
};

/** After a learner turn, the objectives the app would mark now, among the ones still open. */
async function checkObjectives({
  met,
  script,
  turns,
}: {
  met: readonly string[];
  script: ScriptedCall;
  turns: readonly CallTurn[];
}) {
  const open = script.scenario.objectives.filter((objective) => !met.includes(objective.label));

  if (open.length === 0) {
    return [];
  }

  const { data } = await checkConversationObjectives({
    characterNotes: script.scenario.characterBrief,
    learnerLanguage: script.learnerLanguage,
    objectives: open,
    situation: script.scenario.situation,
    targetLanguage: script.targetLanguage,
    turns: turns.map(({ speaker, text }) => ({ speaker, text })),
  });

  return [...new Set(data.met.map((objective) => objective.label))];
}

/**
 * As the app does once the session starts: the opening cue, and once more if the character is
 * still silent a few seconds later.
 */
async function openTheCall({
  openingLine,
  session,
}: {
  openingLine: string;
  session: LiveSession;
}) {
  const cue = formatOpeningCue(openingLine);
  session.cue("instructions", cue);

  const spoke = await waitUntil(
    () => session.call.firstCharacterAt !== null,
    OPENING_RETRY_MS,
    "the opening line",
  ).then(
    () => true,
    () => false,
  );

  if (!spoke) {
    session.cue("instructions", cue);
  }
}

/** One learner line, the character's answer, then the app's objective check and progress cue. */
async function playLearnerTurn({
  audio,
  met,
  script,
  scriptedText,
  session,
  turns,
}: {
  audio: Buffer[];
  met: Set<string>;
  script: ScriptedCall;
  scriptedText: string;
  session: LiveSession;
  turns: CallTurn[];
}) {
  const { call } = session;
  call.learner = "";
  call.audio.push(...audio);
  await waitUntil(() => call.audio.length === 0, REPLY_TIMEOUT_MS, "the learner's audio");
  const spokenAt = Date.now();
  call.character = "";
  call.firstCharacterAt = null;
  const reply = await listenToCharacter(session);

  const learnerTurn: CallTurn = {
    firstTokenMs: call.firstCharacterAt === null ? null : call.firstCharacterAt - spokenAt,
    objectivesMet: [],
    speaker: "learner",
    text: call.learner.trim() || scriptedText,
  };

  turns.push(learnerTurn, {
    firstTokenMs: null,
    objectivesMet: [],
    speaker: "character",
    text: reply,
  });

  // As the app does once the character's answer settles: check, then tell the character where the
  // learner is.
  learnerTurn.objectivesMet = await checkObjectives({ met: [...met], script, turns });

  if (learnerTurn.objectivesMet.length === 0) {
    return;
  }

  for (const label of learnerTurn.objectivesMet) {
    met.add(label);
  }

  const labels = script.scenario.objectives.map((objective) => objective.label);

  session.cue(
    "thinking",
    formatObjectivesProgressCue({ met: [...met], open: labels.filter((label) => !met.has(label)) }),
  );
}

/** The voice models the live conversation eval can drive. */
export function isLiveCallModel(model: string): boolean {
  return model === GPT_LIVE_MODEL || GEMINI_LIVE_MODELS.has(model);
}

function openCall(script: ScriptedCall): Promise<LiveSession> {
  if (GEMINI_LIVE_MODELS.has(script.model)) {
    return openGeminiLiveCall({ instructions: script.instructions, model: script.model });
  }

  return openGptLiveCall({
    instructions: script.instructions,
    targetLanguage: script.targetLanguage,
  });
}

/**
 * Plays one scripted call the way the app connects to the voice model, with the production
 * instructions and the opening cue, then each learner line spoken by text-to-speech at real-time
 * pace. After each of the character's answers, the production objective check reads the
 * transcript so far, as the app does. Ends with a graceful close for the call's usage and cost.
 */
export async function runScriptedLiveCall(
  script: ScriptedCall,
): Promise<{ turns: CallTurn[]; usage: CallUsage | null }> {
  const learnerAudio = await Promise.all(script.learnerTurns.map((text) => speak(text)));
  const session = await openCall(script);
  const turns: CallTurn[] = [];
  const met = new Set<string>();
  let usage: CallUsage | null = null;

  try {
    await openTheCall({ openingLine: script.scenario.openingLine, session });
    const opening = await listenToCharacter(session);
    turns.push({ firstTokenMs: null, objectivesMet: [], speaker: "character", text: opening });

    for (const [index, audio] of learnerAudio.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- The learner speaks, then the character answers.
      await playLearnerTurn({
        audio,
        met,
        script,
        scriptedText: script.learnerTurns[index] ?? "",
        session,
        turns,
      });
    }

    usage = await session.close();
    return { turns, usage };
  } finally {
    if (!usage) {
      await session.close();
    }
  }
}
