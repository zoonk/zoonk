import { type MistakeCauseInput } from "@zoonk/ai/tasks/mistakes/cause";
import { type Mistake, type TransactionClient, prisma } from "@zoonk/db";
import { z } from "zod";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { type MistakeSignals, inferMistakeCause } from "./mistake-cause";
import {
  type MistakeReplay,
  loadMistakeReplay,
  loadMistakeReplays,
  readMistakeReplay,
} from "./mistake-replay";
import { isSameMistakeQuestion } from "./mistake-replay-identity";
import {
  type RecordedMistakeSnapshot as MistakeSnapshot,
  readMistakeSnapshot,
} from "./mistake-snapshot";
import { matchesMistakeSource } from "./mistake-source-snapshot";

type MistakeTarget = { itemId: string | null; stepId: string | null };

async function findOpenMistake({
  itemId,
  stepId,
  replay,
  snapshot,
  transaction,
  userId,
}: MistakeTarget & {
  replay: MistakeReplay | null;
  snapshot: MistakeSnapshot;
  transaction: TransactionClient;
  userId: string;
}) {
  const replayTarget = replay
    ? {
        snapshot: {
          equals: replay.kind === "item" ? replay.item.id : replay.lesson.step.id,
          path:
            replay.kind === "item" ? ["replay", "item", "id"] : ["replay", "lesson", "step", "id"],
        },
      }
    : null;

  const targets = [itemId ? { itemId } : null, stepId ? { stepId } : null, replayTarget].filter(
    (target) => target !== null,
  );

  if (targets.length === 0) {
    return null;
  }

  const open = await transaction.mistake.findMany({
    where: { OR: targets, status: "open", userId },
  });

  const legacyNumeric =
    replay?.kind === "item" && replay.item.format === "numeric"
      ? open.filter((mistake) => !readMistakeReplay(mistake.snapshot))
      : [];

  const restored = await loadMistakeReplays({ mistakes: legacyNumeric, userId });

  return (
    open.find((mistake) => {
      const saved = readMistakeReplay(mistake.snapshot) ?? restored.get(mistake.id);

      if (replay) {
        return saved
          ? isSameMistakeQuestion({ answered: replay, saved })
          : matchesMistakeSource({ replay, snapshot: mistake.snapshot });
      }

      return readMistakeSnapshot(mistake.snapshot).question === snapshot.question;
    }) ?? null
  );
}

function toCauseInput({
  language,
  signals,
  snapshot,
}: {
  language: string;
  signals: MistakeSignals;
  snapshot: MistakeSnapshot;
}): MistakeCauseInput {
  const { correct, total } = signals.recentSkillAnswers;

  return {
    correctAnswer: snapshot.correctAnswer ?? "",
    language,
    learnerAnswer: snapshot.answer ?? "",
    misconception: snapshot.misconception ?? "",
    question: snapshot.question,
    recentAccuracy: `${correct} of ${total} right`,
  };
}

/** Reuses an existing open entry, which waits a day again; an ambiguous cause owes its classification, in the same transaction. */
export async function recordMistake(
  {
    attemptId,
    itemId,
    language,
    missedAt,
    practicedMistakeId,
    signals,
    skillId,
    snapshot,
    stepId,
    targetLanguage,
    userId,
  }: MistakeTarget & {
    attemptId: string;
    language: string;
    missedAt: Date;
    practicedMistakeId?: string | null;
    signals: MistakeSignals;
    skillId: string | null;
    snapshot: MistakeSnapshot;
    targetLanguage?: string | null;
    userId: string;
  },
  transaction: TransactionClient = prisma,
): Promise<Mistake> {
  /** Writing corrections establish the error, not whether the learner misread, guessed or forgot. */
  const isLanguageWriting = Boolean(targetLanguage) && snapshot.format === "typedAnswer";
  const cause = isLanguageWriting ? null : inferMistakeCause(signals);
  const unknownGap = signals.dontKnow && cause === "gap";

  const target = practicedMistakeId
    ? await transaction.mistake.findFirst({
        where: { id: practicedMistakeId, status: "open", userId },
      })
    : null;

  const replay =
    snapshot.replay ??
    (await loadMistakeReplay({ mistake: { attemptId, itemId, snapshot, stepId }, userId }));

  const existing =
    target ?? (await findOpenMistake({ itemId, replay, snapshot, stepId, transaction, userId }));

  if (existing) {
    const original = readMistakeSnapshot(existing.snapshot);

    const preserve =
      !readMistakeReplay(existing.snapshot) &&
      replay &&
      matchesMistakeSource({ replay, snapshot: existing.snapshot });

    const originalJson = JSON.stringify({ ...original, ...(preserve ? { replay } : {}) });
    const originalSnapshot: unknown = JSON.parse(originalJson);

    return transaction.mistake.update({
      data: {
        missedAt: new Date(Math.max(missedAt.getTime(), existing.missedAt.getTime())),
        ...(unknownGap ? { cause: "gap", fixedAt: null, status: "open" } : {}),
        ...(preserve ? { snapshot: z.record(z.string(), z.json()).parse(originalSnapshot) } : {}),
      },
      where: { id: existing.id },
    });
  }

  const serialized = JSON.stringify(replay ? { ...snapshot, replay } : snapshot);
  const preserved: unknown = JSON.parse(serialized);

  const mistake = await transaction.mistake.create({
    data: {
      attemptId,
      cause,
      itemId,
      missedAt,
      skillId,
      snapshot: z.record(z.string(), z.json()).parse(preserved),
      stepId,
      userId,
    },
  });

  if (!cause && !isLanguageWriting) {
    await oweFollowUps({
      db: transaction,
      followUps: [
        {
          input: { cause: toCauseInput({ language, signals, snapshot }), mistakeId: mistake.id },
          kind: "classifyMistakeCause",
        },
      ],
      userId,
    });
  }

  return mistake;
}
