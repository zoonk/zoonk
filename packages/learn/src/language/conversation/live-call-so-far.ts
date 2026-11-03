import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { type TranscriptTurn, getSpokenMs, toConversationTurns } from "./live-call-transcript";

const MS_PER_SECOND = 1000;

/**
 * What "Call again" hands the next connection, in memory only, once a connection of the call went
 * live (until then there's no call to save, so a retry starts over): a call that continues keeps
 * its turns on screen and completes with all of them under `connectionId`, the latest connection
 * the screen saw.
 */
export type CallSoFar = {
  connectionId: string | null;
  examCuesSent: number;
  metLabels: string[];
  spokenMs: number;
  turns: TranscriptTurn[];
  usedHelp: boolean;
};

export function newCallSoFar(conversation: LanguageConversationView): CallSoFar {
  return {
    connectionId: null,
    examCuesSent: 0,
    metLabels: conversation.objectives
      .filter((objective) => objective.met)
      .map((objective) => objective.label),
    spokenMs: 0,
    turns: [],
    usedHelp: false,
  };
}

/**
 * Earlier turns lose their timestamps, so the next session's words start turns of their own and
 * each connection's speech counts once.
 */
export function carryCallSoFar({
  before,
  connectionId,
  examCuesSent,
  live,
  metLabels,
  turns,
  usedHelp,
}: Omit<CallSoFar, "spokenMs"> & { before: CallSoFar; live: boolean }): CallSoFar {
  if (!live && before.connectionId === null) {
    return startCallOver(before);
  }

  return {
    connectionId: connectionId ?? before.connectionId,
    examCuesSent,
    metLabels,
    spokenMs: before.spokenMs + getSpokenMs(turns),
    turns: turns.map((turn) => ({ ...turn, endMs: null, startMs: null })),
    usedHelp,
  };
}

/** The goals stay met: the server keeps them for the conversation, whichever call met them. */
export function startCallOver(before: CallSoFar): CallSoFar {
  return {
    connectionId: null,
    examCuesSent: 0,
    metLabels: before.metLabels,
    spokenMs: 0,
    turns: [],
    usedHelp: false,
  };
}

export function toCallCompletion({
  connectionId,
  spokenMs,
  turns,
  usedHelp,
}: CallSoFar): Omit<LanguageConversationCompletionInput, "timeZone"> | null {
  if (!connectionId) {
    return null;
  }

  return {
    connectionId,
    spokenSeconds: Math.round(spokenMs / MS_PER_SECOND),
    turns: toConversationTurns(turns),
    usedHelp,
  };
}
