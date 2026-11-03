import {
  type GoodbyeRequest,
  acknowledgeGoodbye,
  hearGoodbye,
  requestGoodbye,
} from "./live-call-goodbye";

/**
 * How a live call ends, as one pure function of the clock and what happened: GPT-Live has no
 * "turn done" or "playback done" event, so the app decides when the character says goodbye and
 * when it hangs up. The same rules and test timelines run on Apple and Android.
 */

export type LiveCallTiming = {
  answerWaitMs: number;
  characterQuietMs: number;
  checkInMs: number;
  goodbyeQuietMs: number;
  goodbyeRetryMs: number;
  openingRetryMs: number;
  quietGoodbyeMs: number;
  quietHintMs: number;
};

/** `goodbye`: the learner and the character already said goodbye, so no cue goes out. */
type CallEndingReason = "done" | "goodbye" | "quiet" | "time";

export type CallHangUpReason = CallEndingReason | "hardStop";

/** The SDK refuses an event id it already sent, so the one retry has its own. */
const OPENING_IDS = ["opening", "opening-retry"] as const;

export type CallEndingCommand =
  | { cue: "checkIn"; type: "cue" }
  /** Sent with `id` as its event id, so its acknowledgment comes back with it. */
  | { cue: "opening"; id: (typeof OPENING_IDS)[number]; type: "cue" }
  /**
   * `whileLearnerSpeaks`: measured, a goodbye spoken aloud at once ("commentary") made the character
   * talk over a learner who paused mid-answer; as quiet context ("thinking") it waited for them.
   */
  | { cue: "goodbye" | "goodbyeDone"; id: string; type: "goodbye"; whileLearnerSpeaks: boolean }
  | { type: "progress" }
  | { reason: CallHangUpReason; type: "hangUp" };

export type CallEndingEvent =
  | { at: number; startMs: number; type: "characterSpoke" }
  /** The learner's own words came back as a transcript: they spoke, about 1.5 s before. */
  | { at: number; type: "learnerHeard" }
  /** A microphone sample: `speaking` already holds the platform's hangover. */
  | { at: number; speaking: boolean; type: "speech" }
  | { at: number; type: "typing" }
  | { at: number; type: "sent" }
  | { at: number; id: string; startMs: number | null; type: "acknowledged" }
  /** An objective check's answer for the transcript as it was at `snapshotAt`. */
  | {
      allMet: boolean;
      at: number;
      goodbye: boolean;
      progress: boolean;
      snapshotAt: number;
      type: "checked";
    }
  | { at: number; type: "tick" };

export type CallEndingState = {
  activityAt: number;
  armedAt: number | null;
  characterAt: number | null;
  checkedIn: boolean;
  ended: boolean;
  goodbye: GoodbyeRequest | null;
  hardStopAt: number;
  heardAt: number | null;
  learnerAt: number | null;
  learnerSpeaking: boolean;
  liveAt: number;
  /** When the opening cue was acknowledged; a retry before that would greet twice (measured). */
  openingAckAt: number | null;
  openingRetried: boolean;
  /** When the quiet stretch started: the end of the latest sound or keystroke from anyone. */
  quietFrom: number;
  reason: CallEndingReason | null;
  saidGoodbye: boolean;
  sentAt: number | null;
  spokeOutLoud: boolean;
  talkEndsAt: number;
  timing: LiveCallTiming;
  typingAt: number | null;
};

type Step = { commands: CallEndingCommand[]; state: CallEndingState };

function isRecent(at: number, since: number | null, windowMs: number) {
  return since !== null && at - since < windowMs;
}

function isCharacterSpeaking(state: CallEndingState, at: number) {
  return isRecent(at, state.characterAt, state.timing.characterQuietMs);
}

/** Speaking, or just heard: the model waits for a speaker to finish, so a cue can go now. */
function isLearnerSpeaking(state: CallEndingState, at: number) {
  return state.learnerSpeaking || isRecent(at, state.heardAt, state.timing.characterQuietMs);
}

function canSendGoodbye(state: CallEndingState, at: number) {
  const { answerWaitMs, characterQuietMs } = state.timing;

  // A reply being typed holds the cue too: the model can't see it and would say goodbye over it.
  if (isCharacterSpeaking(state, at) || isRecent(at, state.typingAt, characterQuietMs)) {
    return false;
  }

  const { armedAt, characterAt, sentAt } = state;

  // Measured: a goodbye sent with a typed reply was answered as part of the reply and never said,
  // so it goes once the character answered the learner's last word, whatever else they did.
  if (sentAt !== null && armedAt !== null && sentAt >= armedAt) {
    return (characterAt !== null && characterAt > sentAt) || at - sentAt >= answerWaitMs;
  }

  if (state.reason === "quiet" || isLearnerSpeaking(state, at)) {
    return true;
  }

  const characterStopped = characterAt === null ? state.liveAt : characterAt + characterQuietMs;
  const waitingSince = Math.max(characterStopped, state.learnerAt ?? Number.NEGATIVE_INFINITY);
  return at - waitingSince >= answerWaitMs;
}

function arm(state: CallEndingState, reason: CallEndingReason, at: number): CallEndingState {
  return state.reason
    ? state
    : { ...state, armedAt: at, reason, saidGoodbye: reason === "goodbye" };
}

function quietFor(state: CallEndingState, at: number) {
  return state.learnerSpeaking ? null : at - state.quietFrom;
}

function stepSilence(state: CallEndingState, at: number): Step {
  const quiet = quietFor(state, at);

  if (state.reason || quiet === null) {
    return { commands: [], state };
  }

  if (quiet >= state.timing.quietGoodbyeMs) {
    return { commands: [], state: arm(state, "quiet", at) };
  }

  if (quiet >= state.timing.checkInMs && !state.checkedIn) {
    return { commands: [{ cue: "checkIn", type: "cue" }], state: { ...state, checkedIn: true } };
  }

  return { commands: [], state };
}

/** One goodbye request at a time, sent once more when nothing at all followed it. */
function stepGoodbye(state: CallEndingState, at: number): Step {
  if (!state.reason || state.saidGoodbye) {
    return { commands: [], state };
  }

  const { goodbye } = state;

  const due = goodbye
    ? goodbye.ids.length === 1 &&
      at - Math.max(goodbye.sentAt, state.activityAt) >= state.timing.goodbyeRetryMs
    : canSendGoodbye(state, at);

  if (!due) {
    return { commands: [], state };
  }

  const requested = requestGoodbye(goodbye, at);
  const id = requested.ids.at(-1) ?? "";
  const cue = state.reason === "done" ? "goodbyeDone" : "goodbye";

  return {
    commands: [{ cue, id, type: "goodbye", whileLearnerSpeaks: isLearnerSpeaking(state, at) }],
    state: { ...state, goodbye: requested },
  };
}

function hangUp(state: CallEndingState, reason: CallHangUpReason): Step {
  return { commands: [{ reason, type: "hangUp" }], state: { ...state, ended: true } };
}

function evaluate(state: CallEndingState, at: number): Step {
  if (at >= state.hardStopAt) {
    return hangUp(state, "hardStop");
  }

  const commands: CallEndingCommand[] = [];
  let next = at >= state.talkEndsAt ? arm(state, "time", at) : state;

  if (
    next.characterAt === null &&
    next.openingAckAt !== null &&
    !next.openingRetried &&
    !next.reason &&
    at - next.openingAckAt >= next.timing.openingRetryMs
  ) {
    commands.push({ cue: "opening", id: OPENING_IDS[1], type: "cue" });
    next = { ...next, openingRetried: true };
  }

  for (const step of [stepSilence, stepGoodbye]) {
    const stepped = step(next, at);
    commands.push(...stepped.commands);
    next = stepped.state;
  }

  if (next.saidGoodbye && next.reason && at - next.activityAt >= next.timing.goodbyeQuietMs) {
    const ended = hangUp(next, next.reason);
    return { commands: [...commands, ...ended.commands], state: ended.state };
  }

  return { commands, state: next };
}

function markLearner(state: CallEndingState, at: number): CallEndingState {
  return {
    ...state,
    activityAt: Math.max(state.activityAt, at),
    checkedIn: false,
    learnerAt: at,
    quietFrom: Math.max(state.quietFrom, at),
  };
}

function hearCharacter(state: CallEndingState, at: number, startMs: number): CallEndingState {
  const heard = state.goodbye ? hearGoodbye(state.goodbye, startMs) : null;

  return {
    ...state,
    activityAt: Math.max(state.activityAt, at),
    characterAt: at,
    goodbye: heard?.goodbye ?? null,
    // The character's answer to its own check-in doesn't restart the stretch it checks in on.
    quietFrom: state.checkedIn
      ? state.quietFrom
      : Math.max(state.quietFrom, at + state.timing.characterQuietMs),
    saidGoodbye: state.saidGoodbye || Boolean(heard?.said),
  };
}

function acknowledge(
  state: CallEndingState,
  { at, id, startMs }: Extract<CallEndingEvent, { type: "acknowledged" }>,
): CallEndingState {
  const { goodbye } = state;

  if (OPENING_IDS.some((opening) => opening === id)) {
    return { ...state, openingAckAt: state.openingAckAt ?? at };
  }

  if (!goodbye) {
    return state;
  }

  const acknowledged = acknowledgeGoodbye(goodbye, { id, startMs });

  return {
    ...state,
    goodbye: acknowledged.goodbye,
    saidGoodbye: state.saidGoodbye || acknowledged.said,
  };
}

function check(state: CallEndingState, event: Extract<CallEndingEvent, { type: "checked" }>): Step {
  const learnerMovedOn = state.learnerAt !== null && state.learnerAt > event.snapshotAt;
  const saidGoodbye = event.goodbye && !learnerMovedOn;

  // Both already said goodbye before the cue went out: the cue would make the character say it again.
  if (state.reason) {
    const said = saidGoodbye && !state.goodbye;
    return { commands: [], state: said ? { ...state, saidGoodbye: true } : state };
  }

  if (saidGoodbye) {
    return { commands: [], state: arm(state, "goodbye", event.at) };
  }

  if (event.allMet) {
    return { commands: [], state: arm(state, "done", event.at) };
  }

  return { commands: event.progress ? [{ type: "progress" }] : [], state };
}

function reduce(
  state: CallEndingState,
  event: Exclude<CallEndingEvent, { type: "checked" }>,
): CallEndingState {
  const { at } = event;

  if (event.type === "characterSpoke") {
    return hearCharacter(state, at, event.startMs);
  }

  if (event.type === "acknowledged") {
    return acknowledge(state, event);
  }

  if (event.type === "speech") {
    return event.speaking
      ? { ...markLearner(state, at), learnerSpeaking: true, spokeOutLoud: true }
      : { ...state, learnerSpeaking: false };
  }

  if (event.type === "learnerHeard") {
    return { ...markLearner(state, at), heardAt: at, spokeOutLoud: true };
  }

  if (event.type === "typing") {
    return { ...markLearner(state, at), typingAt: at };
  }

  return event.type === "sent" ? { ...markLearner(state, at), sentAt: at, typingAt: null } : state;
}

export function startCallEnding({
  at,
  hardStopAt,
  talkEndsAt,
  timing,
}: {
  at: number;
  hardStopAt: number;
  talkEndsAt: number;
  timing: LiveCallTiming;
}): Step {
  return {
    commands: [{ cue: "opening", id: OPENING_IDS[0], type: "cue" }],
    state: {
      activityAt: at,
      armedAt: null,
      characterAt: null,
      checkedIn: false,
      ended: false,
      goodbye: null,
      hardStopAt,
      heardAt: null,
      learnerAt: null,
      learnerSpeaking: false,
      liveAt: at,
      openingAckAt: null,
      openingRetried: false,
      quietFrom: at,
      reason: null,
      saidGoodbye: false,
      sentAt: null,
      spokeOutLoud: false,
      talkEndsAt,
      timing,
      typingAt: null,
    },
  };
}

export function stepCallEnding(state: CallEndingState, event: CallEndingEvent): Step {
  if (state.ended) {
    return { commands: [], state };
  }

  const applied =
    event.type === "checked" ? check(state, event) : { commands: [], state: reduce(state, event) };

  const evaluated = evaluate(applied.state, event.at);

  return { commands: [...applied.commands, ...evaluated.commands], state: evaluated.state };
}

export function getCallEndingView(state: CallEndingState, at: number) {
  const quiet = quietFor(state, at);

  return {
    characterSpeaking: isCharacterSpeaking(state, at),
    greeted: state.characterAt !== null,
    learnerSpeaking: state.learnerSpeaking,
    quietHint: quiet !== null && quiet >= state.timing.quietHintMs,
    reason: state.reason,
    saidGoodbye: state.saidGoodbye,
    spokeOutLoud: state.spokeOutLoud,
  };
}

export type CallEndingView = ReturnType<typeof getCallEndingView>;
