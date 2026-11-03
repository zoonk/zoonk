import { type ModelCall, toTokenUsage } from "@/lib/types";
import { checkConversationObjectives } from "@zoonk/ai/tasks/language/conversation-objectives";
import {
  type LiveConversationInstructionsParams,
  buildLiveConversationInstructions,
  getLiveConversationLanguageName,
} from "@zoonk/ai/tasks/language/live-conversation-instructions";
import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import {
  buildLiveCallScript,
  getObjectivesProgressCue,
} from "@zoonk/core/language/conversations/live-call-script";
import {
  type CallTurn,
  type SimulatedLearner,
  buildLearnerPrompt,
  writeLearnerLine,
} from "./learner";
import { type LiveCall, type LiveCallCue, openLiveCall } from "./live-call";

type RolePlayCall = Extract<LiveConversationInstructionsParams, { kind: "unit" }>;

export type LiveConversationInput = { call: RolePlayCall; learner: SimulatedLearner };

type CallProgress = {
  calls: ModelCall[];
  met: string[];
  turns: CallTurn[];
  allMet: boolean;
  saidGoodbye: boolean;
};

type CallContext = {
  call: RolePlayCall;
  cues: LanguageConversationSetup["script"]["cues"];
  learner: SimulatedLearner;
  learnerPrompt: string;
  live: LiveCall;
};

/** The app holds its goodbye until the learner had a chance to answer the character's last words. */
const CLOSING_STEP =
  "Answer what they just said or asked, in a few words. If they asked nothing, just say thanks.";

/** The app's typed-reply cue: its text, then the reply quoted so it reads as data. */
function toTypedReplyCue(cue: LiveCallCue, reply: string): LiveCallCue {
  return { channel: cue.channel, text: `${cue.text}${JSON.stringify(reply)}` };
}

function characterTurn(text: string): CallTurn {
  return { objectivesMet: [], speaker: "character", text };
}

/** What the character said after falling quiet and before the next cue went out. */
function addUnprompted(turns: CallTurn[], before: string): CallTurn[] {
  return before ? [...turns, { ...characterTurn(before), unprompted: true }] : turns;
}

async function say({
  context: { cues, live },
  line,
  note,
  progress,
}: {
  context: CallContext;
  line: string;
  note?: LiveCallCue;
  progress: CallProgress;
}): Promise<CallProgress> {
  const { before, reply } = await live.exchange(toTypedReplyCue(cues.typedReply, line), note);

  return {
    ...progress,
    turns: [
      ...addUnprompted(progress.turns, before),
      { objectivesMet: [], speaker: "learner", text: line },
      characterTurn(reply),
    ],
  };
}

/**
 * The production check the app runs once the character has answered, on the objectives still
 * open; the learner's line before that answer gets the marks.
 */
async function checkObjectives({
  call,
  progress,
}: {
  call: RolePlayCall;
  progress: CallProgress;
}): Promise<CallProgress> {
  const open = call.scenario.objectives.filter(
    (objective) => !progress.met.includes(objective.label),
  );

  const { data, provenance, usage } = await checkConversationObjectives({
    characterNotes: call.scenario.characterBrief,
    learnerLanguage: call.learnerLanguage,
    objectives: open,
    situation: call.scenario.situation,
    targetLanguage: call.targetLanguage,
    turns: progress.turns.map(({ speaker, text }) => ({ speaker, text })),
  });

  const marked = [...new Set(data.met.map((objective) => objective.label))];
  const met = [...progress.met, ...marked];
  const learnerIndex = progress.turns.findLastIndex((turn) => turn.speaker === "learner");

  return {
    allMet: open.every((objective) => met.includes(objective.label)),
    calls: [...progress.calls, { modelId: provenance.requestedModel, usage: toTokenUsage(usage) }],
    met,
    saidGoodbye: data.goodbye,
    turns: progress.turns.map((turn, index) =>
      index === learnerIndex ? { ...turn, objectivesMet: marked } : turn,
    ),
  };
}

/**
 * One learner line per step: the check of the last answer runs while the learner writes, as it runs
 * while they speak in the app, and its progress cue goes out with their line. Once every objective
 * is met or the plan has run out, the learner's line is followed by the app's goodbye cue.
 */
async function playStep({
  context,
  progress,
  step,
}: {
  context: CallContext;
  progress: CallProgress;
  step: number;
}): Promise<CallProgress> {
  const { call, cues, learner, learnerPrompt, live } = context;
  const instruction = learner.plan[step] ?? CLOSING_STEP;

  const [checked, line] = await Promise.all([
    step === 0 ? null : checkObjectives({ call, progress }),
    writeLearnerLine({ step: instruction, systemPrompt: learnerPrompt, turns: progress.turns }),
  ]);

  const heard = { ...(checked ?? progress), calls: [...(checked ?? progress).calls, line.call] };

  if (heard.saidGoodbye) {
    return heard;
  }

  const labels = call.scenario.objectives.map((objective) => objective.label);
  const open = labels.filter((label) => !heard.met.includes(label));

  const note =
    heard.met.length > progress.met.length
      ? getObjectivesProgressCue({ met: heard.met, open })
      : undefined;

  const answered = await say({ context, line: line.text, note, progress: heard });

  if (!heard.allMet && step < learner.plan.length) {
    return playStep({ context, progress: answered, step: step + 1 });
  }

  const { before, reply } = await live.exchange(heard.allMet ? cues.goodbyeDone : cues.goodbye);
  return { ...answered, turns: [...addUnprompted(answered.turns, before), characterTurn(reply)] };
}

/**
 * A practice call as the app runs it, with the production instructions, cues and objective check.
 * A cheap text model plays the learner from the case's plan, typing each line once the character
 * falls quiet, and answers what the character says.
 */
export async function runLiveCall({ call, learner }: LiveConversationInput) {
  const instructions = buildLiveConversationInstructions(call);

  const script = buildLiveCallScript({
    character: call.scenario.character,
    examiner: false,
    language: getLiveConversationLanguageName(call),
    openingLine: call.scenario.openingLine,
  });

  const learnerPrompt = buildLearnerPrompt({
    learner,
    learnerLanguage: call.learnerLanguage,
    level: call.level,
    targetLanguage: call.targetLanguage,
  });

  const live = await openLiveCall({ instructions, script, targetLanguage: call.targetLanguage });
  const context = { call, cues: script.cues, learner, learnerPrompt, live };

  try {
    const first = await live.exchange(script.cues.opening);
    const opening = first.reply ? first : await live.exchange(script.cues.opening);

    const ended = await playStep({
      context,
      progress: {
        allMet: false,
        calls: [],
        met: [],
        saidGoodbye: false,
        turns: [characterTurn(opening.reply)],
      },
      step: 0,
    });

    const seconds = await live.close();

    return { extraCalls: ended.calls, instructions, learnerPrompt, seconds, turns: ended.turns };
  } catch (error) {
    await live.close();
    throw error;
  }
}
