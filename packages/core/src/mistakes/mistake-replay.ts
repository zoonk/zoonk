import "server-only";
import { type CourseLevel, type Mistake, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { readRecordedMath } from "../learner/_utils/math-items";
import { findPlayableStepRows } from "../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../lesson-player/_utils/load-playable-steps";
import { isAnswerableStep } from "../lesson-player/lesson-run";
import { type PlayableLibraryStep } from "../lesson-player/playable-lesson";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { type MathVersion, withRecordedNumbers } from "../library/items/item-math";
import { ITEM_SET_INCLUDE } from "../library/items/item-sets";
import { type SessionItem, parseSessionItem } from "../sessions/_utils/session-items";
import { isSameMistakeQuestion } from "./mistake-replay-identity";
import { matchesMistakeSource } from "./mistake-source-snapshot";

export type MistakeLessonReplay = {
  level: CourseLevel;
  language: string;
  lessonId: string;
  step: PlayableLibraryStep;
  targetLanguage: string | null;
};

export type MistakeReplay =
  | { item: SessionItem; kind: "item"; math?: MathVersion | null }
  | { kind: "lesson"; lesson: MistakeLessonReplay };

type ReplaySource = Pick<Mistake, "itemId" | "stepId"> & {
  snapshot: unknown;
  attemptId?: string | null;
};

const storedReplaySchema = z.custom<MistakeReplay>(
  (value: unknown) =>
    isJsonObject(value) &&
    ((value.kind === "item" && isJsonObject(value.item)) ||
      (value.kind === "lesson" && isJsonObject(value.lesson) && isJsonObject(value.lesson.step))),
);

/** Private payloads are written only by core; public snapshot parsing strips this field. */
export function readMistakeReplay(snapshot: unknown): MistakeReplay | null {
  if (!snapshot || typeof snapshot !== "object" || !("replay" in snapshot)) {
    return null;
  }

  const replay = snapshot.replay;

  if (!replay || typeof replay !== "object" || !("kind" in replay)) {
    return null;
  }

  if (replay.kind === "item" && "item" in replay) {
    return storedReplaySchema.parse(replay);
  }

  return replay.kind === "lesson" && "lesson" in replay ? storedReplaySchema.parse(replay) : null;
}

type LoadedReplay = MistakeReplay & { tutorAvailable: boolean };

function selectOriginalStep({
  candidates,
  snapshot,
}: {
  candidates: LoadedReplay[];
  snapshot: unknown;
}): LoadedReplay | null {
  const matching = candidates.filter((candidate) =>
    matchesMistakeSource({ replay: candidate, snapshot }),
  );

  const original = matching[0];

  return original &&
    matching.every((candidate) => isSameMistakeQuestion({ answered: original, saved: candidate }))
    ? original
    : null;
}

function originalItemReplay({
  item,
  answer,
  snapshot,
}: {
  item: Parameters<typeof parseSessionItem>[0] | undefined;
  answer: unknown;
  snapshot: unknown;
}): LoadedReplay | null {
  const parsed = item ? parseSessionItem(item) : null;

  if (!parsed) {
    return null;
  }

  if (parsed.format === "numeric") {
    const recorded = readRecordedMath(answer);

    const math = recorded
      ? withRecordedNumbers({
          ...parsed.content,
          language: parsed.language,
          values: recorded.values,
        })
      : null;

    const replay: LoadedReplay | null = math
      ? { item: parsed, kind: "item", math, tutorAvailable: true }
      : null;

    return replay && matchesMistakeSource({ replay, snapshot }) ? replay : null;
  }

  const replay: LoadedReplay = { item: parsed, kind: "item", tutorAvailable: true };
  return matchesMistakeSource({ replay, snapshot }) ? replay : null;
}

export async function loadMistakeReplays<TMistake extends ReplaySource & { id: string }>({
  mistakes,
  userId,
}: {
  mistakes: readonly TMistake[];
  userId: string;
}): Promise<Map<string, LoadedReplay | null>> {
  const saved = new Map(
    mistakes.map((mistake) => [mistake.id, readMistakeReplay(mistake.snapshot)]),
  );

  const itemIds = mistakes.flatMap((mistake) => {
    const replay = saved.get(mistake.id);

    if (replay?.kind === "lesson" || (!replay && mistake.stepId)) {
      return [];
    }

    return replay?.kind === "item" ? [replay.item.id] : (mistake.itemId ?? []);
  });

  const stepIds = mistakes.flatMap((mistake) =>
    !saved.get(mistake.id) && mistake.stepId ? [mistake.stepId] : [],
  );

  const lessonIds = [...saved.values()].flatMap((replay) =>
    replay?.kind === "lesson" ? [replay.lesson.lessonId] : [],
  );

  const attemptIds = mistakes.flatMap((mistake) =>
    !saved.get(mistake.id) && mistake.itemId && mistake.attemptId ? [mistake.attemptId] : [],
  );

  const [items, baseRows, parents, attempts, variants] = await Promise.all([
    itemIds.length > 0
      ? prisma.item.findMany({
          include: { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE },
          where: { id: { in: [...new Set(itemIds)] } },
        })
      : [],
    findPlayableStepRows({ learnerVersions: false, stepIds, userId }),
    lessonIds.length > 0
      ? prisma.lesson.findMany({
          select: { id: true },
          where: { id: { in: [...new Set(lessonIds)] }, ...libraryRowsVisibleTo(userId) },
        })
      : [],
    attemptIds.length > 0
      ? prisma.attempt.findMany({
          select: { answer: true, id: true },
          where: { id: { in: attemptIds }, userId },
        })
      : [],
    stepIds.length > 0 ? prisma.stepVariant.findMany({ where: { stepId: { in: stepIds } } }) : [],
  ]);

  const rows = baseRows.flatMap((row) => [
    row,
    ...variants
      .filter((variant) => variant.stepId === row.id)
      .map((variant) => ({ ...row, content: variant.content })),
  ]);

  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt.answer]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const parentIds = new Set(parents.map((lesson) => lesson.id));
  const rowLessonIds = [...new Set(rows.map((row) => row.lessonId))];

  const loaded = await Promise.all(
    rowLessonIds.map(async (lessonId) => {
      const group = rows.filter((row) => row.lessonId === lessonId);
      const first = group[0];

      if (!first) {
        return [];
      }

      const steps = await loadPlayableSteps({ lesson: first.lesson, rows: group });

      return steps
        .filter((step) => isAnswerableStep(step))
        .map((step): [string, LoadedReplay] => [
          step.id,
          {
            kind: "lesson",
            lesson: {
              language: first.lesson.language,
              lessonId,
              level: first.lesson.level,
              step,
              targetLanguage: first.lesson.targetLanguage,
            },
            tutorAvailable: true,
          },
        ]);
    }),
  );

  const stepById = new Map<string, LoadedReplay[]>();

  for (const [stepId, replay] of loaded.flat()) {
    stepById.set(stepId, [...(stepById.get(stepId) ?? []), replay]);
  }

  return new Map(
    mistakes.map((mistake): [string, LoadedReplay | null] => {
      const preserved = saved.get(mistake.id);

      if (preserved?.kind === "lesson") {
        return [
          mistake.id,
          { ...preserved, tutorAvailable: parentIds.has(preserved.lesson.lessonId) },
        ];
      }

      if (!preserved && mistake.stepId) {
        return [
          mistake.id,
          selectOriginalStep({
            candidates: stepById.get(mistake.stepId) ?? [],
            snapshot: mistake.snapshot,
          }),
        ];
      }

      const item = itemById.get(
        preserved?.kind === "item" ? preserved.item.id : (mistake.itemId ?? ""),
      );

      if (item?.retiredAt) {
        return [mistake.id, null];
      }

      if (preserved?.kind === "item") {
        return [mistake.id, { ...preserved, tutorAvailable: item !== undefined }];
      }

      return [
        mistake.id,
        originalItemReplay({
          answer: mistake.attemptId ? attemptById.get(mistake.attemptId) : null,
          item,
          snapshot: mistake.snapshot,
        }),
      ];
    }),
  );
}

/** Existing entries use their own surviving source; retired bank content is never offered. */
export async function loadMistakeReplay({
  mistake,
  userId,
}: {
  mistake: ReplaySource;
  userId: string;
}): Promise<LoadedReplay | null> {
  const id = "original";
  const loaded = await loadMistakeReplays({ mistakes: [{ ...mistake, id }], userId });
  return loaded.get(id) ?? null;
}
