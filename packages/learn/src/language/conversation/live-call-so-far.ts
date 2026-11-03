import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type TranscriptTurn, getSpokenSeconds } from "./live-call-transcript";

/**
 * What "Call again" hands the next connection, in memory only: a call that continues keeps its
 * turns on screen and completes with all of them.
 */
export type CallSoFar = {
  examCuesSent: number;
  metLabels: string[];
  spokenSeconds: number;
  turns: TranscriptTurn[];
  usedHelp: boolean;
};

export function newCallSoFar(conversation: LanguageConversationView): CallSoFar {
  return {
    examCuesSent: 0,
    metLabels: conversation.objectives
      .filter((objective) => objective.met)
      .map((objective) => objective.label),
    spokenSeconds: 0,
    turns: [],
    usedHelp: false,
  };
}

/**
 * Earlier turns lose their timestamps, so the next session's words start turns of their own and
 * each connection's spoken seconds count once.
 */
export function carryCallSoFar({
  before,
  examCuesSent,
  metLabels,
  turns,
  usedHelp,
}: Omit<CallSoFar, "spokenSeconds"> & { before: CallSoFar }): CallSoFar {
  return {
    examCuesSent,
    metLabels,
    spokenSeconds: before.spokenSeconds + getSpokenSeconds(turns),
    turns: turns.map((turn) => ({ ...turn, endMs: null, startMs: null })),
    usedHelp,
  };
}

/** The goals stay met: the server keeps them for the conversation, whichever call met them. */
export function startCallOver(before: CallSoFar): CallSoFar {
  return {
    examCuesSent: 0,
    metLabels: before.metLabels,
    spokenSeconds: 0,
    turns: [],
    usedHelp: false,
  };
}
