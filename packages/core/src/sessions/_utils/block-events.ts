import { type LearningEventKind, type StudySessionBlock } from "@zoonk/db";
import { CHECKPOINT_LEDGER_KINDS } from "../../checkpoints/_utils/checkpoint-results";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { type BlockPayload } from "../block-payload";
import { BRAIN_POWER_BONUS, getAnswersEnergyDelta } from "../brain-power";
import { type SessionAnswer } from "./session-answers";

/** Full-review rows count as the real-conditions test replacing a mock excluded from the learner's plan. */
export const FULL_REVIEW_LEDGER_KIND = "fullReview";

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
  /** Must match answers order. */
  points: readonly number[];
  /** Any per-capsule remainder belongs on the last ledger row. */
  brainPower: number;
  block: StudySessionBlock;
  payload: BlockPayload;
  seconds: number;
};

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

const PLACEMENT_LEDGER_KIND = "placement";

function getReviewRow(context: BlockEventContext, own: readonly SessionAnswer[]) {
  const { answers, points } = context;

  return {
    brainPower: answers.reduce(
      (sum, answer, index) => (own.includes(answer) ? sum + (points[index] ?? 0) : sum),
      0,
    ),
    ...countAnswers(own),
    kind: "review" as const,
    seconds: Math.floor((context.seconds * own.length) / Math.max(1, answers.length)),
  };
}

/** Split points and seconds without rounding each share upward; put remainders on the last row. */
function getReviewEvents(context: BlockEventContext): BlockEvent[] {
  const { answers, block, payload } = context;

  const capsules = payload.capsules.flatMap((capsule) => {
    const own = answers.filter(
      (answer) => answer.itemId && capsule.itemIds.includes(answer.itemId),
    );

    if (own.length === 0) {
      return [];
    }

    const row = getReviewRow(context, own);

    return [
      {
        ...row,
        brainPower: row.brainPower + BRAIN_POWER_BONUS.capsuleOpened,
        contentIds: {
          ...getIds({ block, payload }),
          ...(capsule.lessonId ? { lessonId: capsule.lessonId } : {}),
        },
        lessonKind: CAPSULE_LEDGER_KIND,
        titleSnapshot: capsule.title,
      },
    ];
  });

  const placement = answers.filter(
    (answer) => answer.itemId && payload.placementItemIds.includes(answer.itemId),
  );

  const opened =
    placement.length === 0
      ? capsules
      : [
          ...capsules,
          {
            ...getReviewRow(context, placement),
            contentIds: getIds({ block, payload }),
            lessonKind: PLACEMENT_LEDGER_KIND,
            titleSnapshot: payload.title,
          },
        ];

  const rest = context.brainPower - opened.reduce((sum, event) => sum + event.brainPower, 0);
  const restSeconds = context.seconds - opened.reduce((sum, event) => sum + event.seconds, 0);

  return opened.map((event, index) =>
    index === opened.length - 1
      ? { ...event, brainPower: event.brainPower + rest, seconds: event.seconds + restSeconds }
      : event,
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

function getPracticeKind(payload: BlockEventContext["payload"]): string {
  if (payload.extra) {
    return "extraPractice";
  }

  return payload.fullReview ? FULL_REVIEW_LEDGER_KIND : "practice";
}

export function getBlockEvents(context: BlockEventContext): BlockEvent[] {
  if (context.block.kind === "review") {
    return getReviewEvents(context);
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
      lessonKind: getPracticeKind(context.payload),
      seconds: context.seconds,
      titleSnapshot: context.payload.title,
    },
  ];
}
