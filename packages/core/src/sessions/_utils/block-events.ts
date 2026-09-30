import { type LearningEventKind, type StudySessionBlock } from "@zoonk/db";
import { CHECKPOINT_LEDGER_KINDS } from "../../checkpoints/_utils/checkpoint-results";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { type BlockPayload } from "../block-payload";
import { BRAIN_POWER_BONUS, getAnswersEnergyDelta } from "../brain-power";
import { type SessionAnswer } from "./session-answers";

/** One ledger row a finished block writes, before the shared fields are added. */
export type BlockEvent = {
  brainPower: number;
  contentIds: Record<string, string>;
  correctAnswers: number;
  energyDelta: number;
  incorrectAnswers: number;
  kind: LearningEventKind;
  lessonKind: string;
  seconds: number;
  titleSnapshot: string | null;
};

export type BlockEventContext = {
  answers: readonly SessionAnswer[];
  /** Each answer's Brain Power, in the same order as `answers`. */
  points: readonly number[];
  /** The block's whole Brain Power; what the per-capsule split leaves goes to the last row. */
  brainPower: number;
  block: StudySessionBlock;
  payload: BlockPayload;
  seconds: number;
};

/** Right and wrong answers, and the Energy they give by today's rules. */
function countAnswers(answers: readonly SessionAnswer[]) {
  const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
  const incorrectAnswers = answers.length - correctAnswers;

  return {
    correctAnswers,
    energyDelta: getAnswersEnergyDelta({ correct: correctAnswers, incorrect: incorrectAnswers }),
    incorrectAnswers,
  };
}

function getIds({ block, payload }: Pick<BlockEventContext, "block" | "payload">) {
  return {
    studySessionBlockId: block.id,
    studySessionId: block.sessionId,
    ...(payload.planItemId ? { planItemId: payload.planItemId } : {}),
  };
}

/**
 * Opened capsules each get a `review` row, so the ledger counts capsules (Retro glasses) and
 * reviews without reading content. Each row carries its answers' points and the capsule bonus;
 * whatever the block earned beyond that (mastery, caps) lands on the last row.
 */
function getCapsuleEvents(context: BlockEventContext): BlockEvent[] {
  const { answers, block, payload, points } = context;
  const total = Math.max(1, answers.length);

  const opened = payload.capsules.flatMap((capsule) => {
    const own = answers.filter(
      (answer) => answer.itemId && capsule.itemIds.includes(answer.itemId),
    );

    const ownPoints = answers.reduce(
      (sum, answer, index) => (own.includes(answer) ? sum + (points[index] ?? 0) : sum),
      0,
    );

    return own.length === 0
      ? []
      : [
          {
            brainPower: ownPoints + BRAIN_POWER_BONUS.capsuleOpened,
            contentIds: {
              ...getIds({ block, payload }),
              ...(capsule.lessonId ? { lessonId: capsule.lessonId } : {}),
            },
            ...countAnswers(own),
            kind: "review" as const,
            lessonKind: CAPSULE_LEDGER_KIND,
            seconds: Math.round((context.seconds * own.length) / total),
            titleSnapshot: capsule.title,
          },
        ];
  });

  const split = opened.reduce((sum, event) => sum + event.brainPower, 0);
  const rest = context.brainPower - split;

  return opened.map((event, index) =>
    index === opened.length - 1 ? { ...event, brainPower: event.brainPower + rest } : event,
  );
}

function getCheckpointEvent(context: BlockEventContext): BlockEvent {
  const { answers, block, payload } = context;
  const checkpoint = payload.checkpoint;

  return {
    brainPower: context.brainPower,
    contentIds: getIds({ block, payload }),
    ...countAnswers(answers),
    kind: checkpoint?.mock ? "mock" : "checkpoint",
    lessonKind: CHECKPOINT_LEDGER_KINDS[checkpoint?.kind ?? "weekly"],
    seconds: context.seconds,
    titleSnapshot: payload.title,
  };
}

/** The ledger rows for a finished question block: capsules, practice or a checkpoint. */
export function getBlockEvents(context: BlockEventContext): BlockEvent[] {
  if (context.block.kind === "review") {
    return getCapsuleEvents(context);
  }

  if (context.block.kind === "checkpoint") {
    return [getCheckpointEvent(context)];
  }

  return [
    {
      brainPower: context.brainPower,
      contentIds: getIds(context),
      ...countAnswers(context.answers),
      kind: "questions",
      lessonKind: context.payload.extra ? "extraPractice" : "practice",
      seconds: context.seconds,
      titleSnapshot: context.payload.title,
    },
  ];
}
