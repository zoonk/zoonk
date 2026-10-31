import "server-only";
import { isDeepStrictEqual } from "node:util";
import {
  type FixAlphabetLessonParams,
  type PublishedAlphabetLesson,
  fixAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance } from "../../_utils/library-rows";
import { getFixReach } from "../../lessons/_utils/fix-reach";
import { CURRENT_STEPS, lockCurrentLessonVersion } from "../../lessons/lesson-versions";
import { BACKGROUND_TIER } from "../../quality/_utils/published-versions";
import { toLaterReviewProblems } from "../../quality/later-reviews";
import { parseStepContent } from "../../steps/contract/step-contract";
import { toAlphabetLessonCheck } from "./alphabet-lesson-check";
import { buildAlphabetLessonSteps } from "./alphabet-lesson-steps";
import { insertAlphabetVersion, voiceLetters } from "./write-alphabet-lesson";

type Analytics = Parameters<typeof checkLessonQuality>[0]["analytics"];

type ReviewContext = { analytics?: Analytics; lessonId: string; workflowRunId: string };

export type AlphabetReview = { problems: FixAlphabetLessonParams["problems"]; version: number };

export type AlphabetFix =
  | { status: "replaced" | "unfixed" }
  | { lesson: PublishedAlphabetLesson; provenance: LibraryProvenance; status: "fixed" };

async function loadPublishedAlphabetLesson(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    select: {
      canDo: true,
      description: true,
      language: true,
      model: true,
      steps: {
        orderBy: { position: "asc" },
        select: {
          content: true,
          generatedAt: true,
          kind: true,
          model: true,
          promptVersion: true,
          runId: true,
          version: true,
        },
        where: CURRENT_STEPS,
      },
      targetLanguage: true,
      title: true,
    },
    where: { contentStatus: "completed", id: lessonId },
  });

  const [first] = lesson?.steps ?? [];

  if (!lesson?.targetLanguage || !first) {
    return null;
  }

  const contentOf = <Kind extends "alphabet" | "explanation" | "summary">(kind: Kind) =>
    lesson.steps.flatMap((step) =>
      step.kind === kind ? [parseStepContent(kind, step.content)] : [],
    );

  const letters = contentOf("alphabet");

  const content: PublishedAlphabetLesson = {
    canDo: lesson.canDo ?? "",
    description: lesson.description,
    intro: contentOf("explanation").map(({ text, title }) => ({ text, title: title ?? "" })),
    letters: letters.map(({ audioText, forms, pronunciation, readingAid, symbol }) => ({
      audioText,
      forms,
      pronunciation,
      readingAid,
      symbol,
    })),
    summary: contentOf("summary").flatMap(({ ideas }) => ideas.map((idea) => idea.text)),
    title: lesson.title,
  };

  return {
    audioUrls: new Map(letters.map((letter) => [letter.audioText, letter.audioUrl])),
    content,
    learnerLanguage: lesson.language,
    steps: lesson.steps,
    targetLanguage: lesson.targetLanguage,
    version: first.version,
    writerModel: lesson.model,
  };
}

type PublishedAlphabet = NonNullable<Awaited<ReturnType<typeof loadPublishedAlphabetLesson>>>;

function toCheck(published: PublishedAlphabet, lesson = published.content) {
  return toAlphabetLessonCheck({
    learnerLanguage: published.learnerLanguage,
    lesson,
    targetLanguage: published.targetLanguage,
  });
}

function toTaskAnalytics({ analytics, workflowRunId }: ReviewContext): Analytics {
  return { ...analytics, contentScope: "shared", traceId: workflowRunId };
}

/** Internal workflow bridge: null when the lesson is no longer published. */
export async function reviewAlphabetLesson(context: ReviewContext): Promise<AlphabetReview | null> {
  const published = await loadPublishedAlphabetLesson(context.lessonId);

  if (!published) {
    return null;
  }

  const { data } = await checkLessonQuality({
    ...toCheck(published),
    analytics: toTaskAnalytics(context),
    reuse: "bounded",
    serviceTier: BACKGROUND_TIER,
    writerModel: published.writerModel,
  });

  return { problems: toLaterReviewProblems(data.issues), version: published.version };
}

/** Internal workflow bridge: rewrites only the screens `problems` name in `version`. */
export async function writeAlphabetFix({
  problems,
  version,
  ...context
}: ReviewContext & AlphabetReview): Promise<AlphabetFix> {
  const published = await loadPublishedAlphabetLesson(context.lessonId);

  if (published?.version !== version) {
    return { status: "replaced" };
  }

  const { data, provenance } = await fixAlphabetLesson({
    analytics: toTaskAnalytics(context),
    learnerLanguage: published.learnerLanguage,
    lesson: published.content,
    problems,
    serviceTier: BACKGROUND_TIER,
    targetLanguage: published.targetLanguage,
  });

  const { unfixed } = getFixReach({
    draft: toCheck(published).lesson,
    fixed: toCheck(published, data).lesson,
    incorrect: problems,
    problems,
  });

  return unfixed.length > 0 ? { status: "unfixed" } : { lesson: data, provenance, status: "fixed" };
}

/** Internal workflow bridge: null when `replaces` is no longer the published version. */
export async function publishAlphabetFix({
  lesson,
  lessonId,
  provenance,
  replaces,
}: {
  lesson: PublishedAlphabetLesson;
  lessonId: string;
  provenance: LibraryProvenance;
  replaces: number;
}): Promise<number | null> {
  const published = await loadPublishedAlphabetLesson(lessonId);

  if (published?.version !== replaces) {
    return null;
  }

  const voiced = await voiceLetters({
    letters: lesson.letters.filter((letter) => !published.audioUrls.has(letter.audioText.trim())),
    targetLanguage: published.targetLanguage,
  });

  const audioUrls = new Map([
    ...[...published.audioUrls].flatMap(([text, url]) => (url ? [[text, url] as const] : [])),
    ...voiced,
  ]);

  const steps = buildAlphabetLessonSteps({ audioUrls, content: lesson }).map((step, position) => {
    const previous = published.steps[position];
    const kept = previous?.kind === step.kind && isDeepStrictEqual(previous.content, step.content);
    return { ...step, provenance: kept ? previous : provenance };
  });

  const version = await prisma.$transaction(async (tx) => {
    if ((await lockCurrentLessonVersion(tx, lessonId)) !== replaces) {
      return null;
    }

    await tx.lesson.update({
      data: { summary: { ideas: lesson.summary.map((text) => ({ text })) } },
      where: { id: lessonId },
    });

    return insertAlphabetVersion(tx, { lessonId, steps });
  });

  if (version !== null) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return version;
}
