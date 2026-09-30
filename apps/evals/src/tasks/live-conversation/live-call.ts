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
/** PCM16 mono: two bytes a sample. */
const CHUNK_BYTES = (SAMPLE_RATE * 2 * CHUNK_MS) / MS_PER_SECOND;
const STARTUP_TIMEOUT_MS = 20_000;
const REPLY_TIMEOUT_MS = 30_000;
/** The character has finished its turn once its transcript stays quiet this long. */
const QUIET_MS = 2500;
const CLOSE_TIMEOUT_MS = 5000;
/** The app tells GPT-Live to open the call again when it's still silent after this long. */
const OPENING_RETRY_MS = 5000;
const POLL_MS = 100;

/** A text-to-speech voice for the scripted learner, on AI Gateway, returning raw PCM16 at 24 kHz. */
const LEARNER_VOICE = { model: "google/gemini-3.8-flash-tts", voice: "Kore" } as const;

export type CallTurn = {
  speaker: "character" | "learner";
  /** What GPT-Live heard the learner say (its own transcript), or what the character said. */
  text: string;
  /** Objectives the app marked after this learner turn, as it does when the character answers. */
  objectivesMet: string[];
  /** From the end of the learner's audio to the character's first transcribed word. */
  firstTokenMs: number | null;
};

type LiveEvent = { [key: string]: unknown; type: string };

type Call = {
  audio: Buffer[];
  character: string;
  closed: { seconds: number } | null;
  firstCharacterAt: number | null;
  lastCharacterAt: number;
  learner: string;
  send: (event: object) => void;
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

/** The scripted learner's line as GPT-Live will hear it: speech, split into 20 ms chunks. */
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

function handleEvent(call: Call, event: LiveEvent) {
  if (event.type === "session.output_transcript.delta") {
    call.character += readDelta(event);
    call.firstCharacterAt ??= Date.now();
    call.lastCharacterAt = Date.now();
  }

  if (event.type === "session.input_transcript.delta") {
    call.learner += readDelta(event);
  }

  if (event.type === "session.delegation.created") {
    const delegation = event.delegation as { id?: string } | undefined;

    call.send({
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
}

/** Opens the Live WebSocket the way the browser does and streams audio at real-time pace. */
async function openCall({ instructions, voice }: { instructions: string; voice: string }) {
  const connection = await createLiveConversationToken();
  const socket = new WebSocket(connection.url, connection.protocols);
  let started = false;
  let failure: Error | null = null;

  const call: Call = {
    audio: [],
    character: "",
    closed: null,
    firstCharacterAt: null,
    lastCharacterAt: 0,
    learner: "",
    send: (event) => socket.send(JSON.stringify(event)),
  };

  socket.addEventListener("message", (message) => {
    try {
      const event = JSON.parse(String(message.data)) as LiveEvent;
      started ||= event.type === "session.started";
      handleEvent(call, event);
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("The Live socket failed")));
  });

  // The same session the app starts: the production instructions, PCM16 at 24 kHz, client delegation.
  call.send({
    session: {
      audio: { format: { rate: SAMPLE_RATE, type: "audio/pcm" }, output: { voice } },
      delegation: { type: "client" },
      instructions,
      model: connection.model,
      store: false,
    },
    type: "session.start",
  });

  await waitUntil(() => started || failure !== null, STARTUP_TIMEOUT_MS, "session.started");

  // GPT-Live only moves on while audio streams in: the learner's speech, or silence.
  const pump = setInterval(() => {
    const chunk = call.audio.shift() ?? Buffer.alloc(CHUNK_BYTES);
    call.send({ audio: chunk.toString("base64"), type: "session.input_audio.append" });
  }, CHUNK_MS);

  const close = async () => {
    clearInterval(pump);

    if (socket.readyState === WebSocket.OPEN) {
      call.send({ type: "session.close" });

      await waitUntil(() => call.closed !== null, CLOSE_TIMEOUT_MS, "session.closed").catch(
        () => null,
      );
    }

    socket.close();
    return call.closed?.seconds ?? null;
  };

  const check = () => {
    if (failure) {
      throw failure;
    }
  };

  return { call, check, close };
}

/**
 * Waits for the character's whole turn: its first words, then a quiet stretch. A character that
 * stays silent leaves an empty turn, which the scorer counts as a missed reply.
 */
async function listenToCharacter({ call, check }: Awaited<ReturnType<typeof openCall>>) {
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
        !(error instanceof Error && error.message.startsWith("GPT-Live"))
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
 * As the app does right after `session.started`: the opening cue, and once more if the character
 * is still silent a few seconds later.
 */
async function openTheCall({
  openingLine,
  session,
}: {
  openingLine: string;
  session: Awaited<ReturnType<typeof openCall>>;
}) {
  const cue = {
    content: formatOpeningCue(openingLine),
    delegation_id: null,
    type: "session.instructions.append",
  };

  session.call.send(cue);

  const spoke = await waitUntil(
    () => session.call.firstCharacterAt !== null,
    OPENING_RETRY_MS,
    "the opening line",
  ).then(
    () => true,
    () => false,
  );

  if (!spoke) {
    session.call.send(cue);
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
  session: Awaited<ReturnType<typeof openCall>>;
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

  // As the app does once the character's answer settles: check, then tell GPT-Live where the
  // learner is.
  learnerTurn.objectivesMet = await checkObjectives({ met: [...met], script, turns });

  if (learnerTurn.objectivesMet.length === 0) {
    return;
  }

  for (const label of learnerTurn.objectivesMet) {
    met.add(label);
  }

  const labels = script.scenario.objectives.map((objective) => objective.label);

  call.send({
    content: formatObjectivesProgressCue({
      met: [...met],
      open: labels.filter((label) => !met.has(label)),
    }),
    delegation_id: null,
    type: "session.thinking.append",
  });
}

/**
 * Plays one scripted call on GPT-Live the way the app connects: a token from the production token
 * task, `session.start` with the production instructions, the opening cue, then each learner line
 * spoken by text-to-speech at real-time pace. After each of the character's answers, the
 * production objective check reads the transcript so far, as the app does. Ends with a graceful
 * close for the session's billed seconds.
 */
export async function runScriptedLiveCall(
  script: ScriptedCall,
): Promise<{ turns: CallTurn[]; voiceSeconds: number | null }> {
  const learnerAudio = await Promise.all(script.learnerTurns.map((text) => speak(text)));

  const session = await openCall({
    instructions: script.instructions,
    voice: getLiveConversationVoice(script.targetLanguage),
  });

  const turns: CallTurn[] = [];
  const met = new Set<string>();

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

    return { turns, voiceSeconds: await session.close() };
  } finally {
    await session.close();
  }
}
