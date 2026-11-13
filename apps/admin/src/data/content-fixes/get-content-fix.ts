import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { batchOf, batchWhere } from "@zoonk/core/staff/content-fixes/batches";
import {
  type StoredChange,
  contentFixChangesSchema,
  contentFixEffectsSchema,
} from "@zoonk/core/staff/content-fixes/contract";
import { contentFixVoiceSchema } from "@zoonk/core/staff/content-fixes/voice-schema";
import { prisma } from "@zoonk/db";
import { loadContentFixLocations } from "./content-fix-locations";

const person = { select: { email: true, id: true, name: true } } as const;

function idsOf(changes: readonly StoredChange[], model: StoredChange["model"]): string[] {
  return changes.filter((change) => change.model === model).map((change) => change.id);
}

/** A lesson row is keyed by its lesson and its word or sentence, which other rows share. */
export function rowKeyOf(change: StoredChange): string {
  return "lessonId" in change ? `${change.lessonId}:${change.id}` : change.id;
}

function lessonRowIds(changes: readonly StoredChange[], model: "LessonSentence" | "LessonWord") {
  return changes.flatMap((change) =>
    change.model === model ? [{ id: change.id, lessonId: change.lessonId }] : [],
  );
}

async function loadVocabularyLabels(changes: readonly StoredChange[]) {
  const lessonWords = lessonRowIds(changes, "LessonWord");
  const lessonSentences = lessonRowIds(changes, "LessonSentence");

  const [words, sentences, guides, lessons] = await Promise.all([
    prisma.word.findMany({
      select: { id: true, word: true },
      where: { id: { in: [...idsOf(changes, "Word"), ...lessonWords.map((row) => row.id)] } },
    }),
    prisma.sentence.findMany({
      select: { id: true, sentence: true },
      where: {
        id: { in: [...idsOf(changes, "Sentence"), ...lessonSentences.map((row) => row.id)] },
      },
    }),
    prisma.wordPronunciation.findMany({
      select: { id: true, userLanguage: true, word: { select: { word: true } } },
      where: { id: { in: idsOf(changes, "WordPronunciation") } },
    }),
    prisma.lesson.findMany({
      select: { id: true, title: true },
      where: { id: { in: [...lessonWords, ...lessonSentences].map((row) => row.lessonId) } },
    }),
  ]);

  const texts = new Map([
    ...words.map((row): [string, string] => [row.id, row.word]),
    ...sentences.map((row): [string, string] => [row.id, row.sentence]),
  ]);

  const titles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));

  return [
    ...words.map((row): [string, string] => [row.id, `Word “${row.word}”`]),
    ...sentences.map((row): [string, string] => [row.id, `Sentence “${row.sentence}”`]),
    ...guides.map((guide): [string, string] => [
      guide.id,
      `How to say “${guide.word.word}” · for ${guide.userLanguage} speakers`,
    ]),
    ...[...lessonWords, ...lessonSentences].map(({ id, lessonId }): [string, string] => [
      `${lessonId}:${id}`,
      `“${texts.get(id) ?? ""}” in ${titles.get(lessonId) ?? "a deleted lesson"}`,
    ]),
  ];
}

function screenLabel(step: { kind: string; position: number }): string {
  return `Screen ${String(step.position + 1)} · ${step.kind}`;
}

/** What each changed row is, in the reviewer's terms. A row deleted since has no label. */
async function loadRowLabels(changes: readonly StoredChange[]): Promise<Map<string, string>> {
  const [steps, variants, explanations, vocabulary] = await Promise.all([
    prisma.step.findMany({
      select: { id: true, kind: true, position: true },
      where: { id: { in: idsOf(changes, "Step") } },
    }),
    prisma.stepVariant.findMany({
      select: { id: true, key: true, kind: true, step: { select: { kind: true, position: true } } },
      where: { id: { in: idsOf(changes, "StepVariant") } },
    }),
    prisma.answerExplanation.findMany({
      select: { id: true, step: { select: { kind: true, position: true } } },
      where: { id: { in: idsOf(changes, "AnswerExplanation") } },
    }),
    loadVocabularyLabels(changes),
  ]);

  return new Map([
    ...steps.map((step): [string, string] => [step.id, screenLabel(step)]),
    ...variants.map((variant): [string, string] => [
      variant.id,
      `${screenLabel(variant.step)} · ${variant.kind}${variant.key ? ` ${variant.key}` : ""} version`,
    ]),
    ...explanations.map((explanation): [string, string] => [
      explanation.id,
      explanation.step
        ? `Answer explanation · ${screenLabel(explanation.step)}`
        : "Answer explanation · practice question",
    ]),
    ...vocabulary,
  ]);
}

const fixInclude = {
  decider: person,
  feedback: { select: { createdAt: true, id: true, message: true } },
  proposer: person,
  revertedBy: { orderBy: { createdAt: "desc" }, select: { id: true, status: true } },
  reverts: { select: { id: true } },
} as const;

function findFixes(where: { id: string } | ReturnType<typeof batchWhere>) {
  return prisma.contentFix.findMany({ include: fixInclude, orderBy: { id: "asc" }, where });
}

type FixRow = Awaited<ReturnType<typeof findFixes>>[number];

async function toDetails(fixes: readonly FixRow[]) {
  const changes = fixes.map((fix) => contentFixChangesSchema.parse(fix.changes));

  const [locate, rowLabels] = await Promise.all([
    loadContentFixLocations(fixes),
    loadRowLabels(changes.flat()),
  ]);

  return fixes.map((fix, index) => ({
    ...fix,
    batchId: batchOf(fix),
    changes: changes[index] ?? [],
    effects: contentFixEffectsSchema.parse(fix.effects),
    location: locate(fix),
    rowLabels,
    voice: contentFixVoiceSchema.nullable().parse(fix.voice),
  }));
}

export type ContentFixDetail = Awaited<ReturnType<typeof toDetails>>[number];

export const getContentFix = cacheAdminData(async (id: string) => {
  const [fix] = await findFixes({ id });

  if (!fix) {
    return null;
  }

  const [[detail], batchSize] = await Promise.all([
    toDetails([fix]),
    prisma.contentFix.count({ where: batchWhere(batchOf(fix)) }),
  ]);

  return detail ? { ...detail, batchSize } : null;
});

/** Every fix proposed together, in the order the proposal listed them. */
export const getContentFixBatch = cacheAdminData(async (batchId: string) => {
  const fixes = await findFixes(batchWhere(batchId));

  return fixes.length > 0 ? toDetails(fixes) : null;
});
