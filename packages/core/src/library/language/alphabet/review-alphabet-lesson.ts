import "server-only";
import { isDeepStrictEqual } from "node:util";
import {
  type FixAlphabetLessonParams,
  type PublishedAlphabetLesson,
  fixAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance } from "../../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../../_utils/plan-input-write";
import { CURRENT_STEPS, lockCurrentLessonVersion } from "../../lessons/lesson-versions";
import { BACKGROUND_TIER } from "../../quality/_utils/published-versions";
import { toLaterReviewProblems } from "../../quality/later-reviews";
import { parseStepContent } from "../../steps/contract/step-contract";
import { toAlphabetLessonCheck } from "./alphabet-lesson-check";
import { buildAlphabetLessonSteps } from "./alphabet-lesson-steps";
import { checkAlphabetFix } from "./alphabet-lesson-validator";
import { listAlphabetClips, saveAlphabetVersion } from "./write-alphabet-lesson";

type Analytics = Parameters<typeof checkLessonQuality>[0]["analytics"];

type ReviewContext = {
  analytics?: Analytics;
  lessonId: string;
  version: number;
  workflowRunId: string;
};

type Problems = FixAlphabetLessonParams["problems"];

export type AlphabetFix =
  | { status: "replaced" | "unfixed" }
  | {
      clips: string[];
      lesson: PublishedAlphabetLesson;
      provenance: LibraryProvenance;
      status: "fixed";
      targetLanguage: string;
    };

class AlphabetFixLostError extends Error {
  override name = "AlphabetFixLostError";
}

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

function toTaskAnalytics({ analytics, workflowRunId }: ReviewContext): Analytics {
  return { ...analytics, contentScope: "shared", traceId: workflowRunId };
}

/** Internal workflow bridge: null when `version` is no longer the published version. */
export async function reviewAlphabetLesson(context: ReviewContext): Promise<Problems | null> {
  const published = await loadPublishedAlphabetLesson(context.lessonId);

  if (published?.version !== context.version) {
    return null;
  }

  const { data } = await checkLessonQuality({
    ...toAlphabetLessonCheck({
      learnerLanguage: published.learnerLanguage,
      lesson: published.content,
      targetLanguage: published.targetLanguage,
    }),
    analytics: toTaskAnalytics(context),
    reuse: "bounded",
    serviceTier: BACKGROUND_TIER,
    writerModel: published.writerModel,
  });

  return toLaterReviewProblems(data.issues);
}

/**
 * Internal workflow bridge: rewrites only the parts `problems` name in `version`. A fix that leaves
 * one of them as it was or fails the lesson's checks is `unfixed`.
 */
export async function writeAlphabetFix({
  problems,
  ...context
}: ReviewContext & { problems: Problems }): Promise<AlphabetFix> {
  const published = await loadPublishedAlphabetLesson(context.lessonId);

  if (published?.version !== context.version) {
    return { status: "replaced" };
  }

  const { targetLanguage } = published;

  const { data, provenance } = await fixAlphabetLesson({
    analytics: toTaskAnalytics(context),
    learnerLanguage: published.learnerLanguage,
    lesson: published.content,
    problems,
    serviceTier: BACKGROUND_TIER,
    targetLanguage,
  });

  const checks = checkAlphabetFix({
    fixed: data,
    lesson: published.content,
    problems,
    targetLanguage,
  });

  if (checks.some((check) => !check.passed)) {
    return { status: "unfixed" };
  }

  return {
    clips: listAlphabetClips({
      letters: data.letters,
      targetLanguage,
      voiced: published.audioUrls,
    }),
    lesson: data,
    provenance,
    status: "fixed",
    targetLanguage,
  };
}

/** Internal workflow bridge: null when `replaces` is no longer the published version. */
export async function publishAlphabetFix({
  audioUrls: voiced,
  lesson,
  lessonId,
  provenance,
  replaces,
}: {
  audioUrls: Readonly<Record<string, string>>;
  lesson: PublishedAlphabetLesson;
  lessonId: string;
  provenance: LibraryProvenance;
  replaces: number;
}): Promise<number | null> {
  const published = await loadPublishedAlphabetLesson(lessonId);

  if (published?.version !== replaces) {
    return null;
  }

  const audioUrls = new Map([
    ...[...published.audioUrls].flatMap(([text, url]) => (url ? [[text, url] as const] : [])),
    ...Object.entries(voiced),
  ]);

  const steps = buildAlphabetLessonSteps({ audioUrls, content: lesson }).map((step, position) => {
    const previous = published.steps[position];
    const kept = previous?.kind === step.kind && isDeepStrictEqual(previous.content, step.content);
    return { ...step, provenance: kept ? previous : provenance };
  });

  const { data: version, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      if ((await lockCurrentLessonVersion(tx, lessonId)) !== replaces) {
        throw new AlphabetFixLostError();
      }

      return saveAlphabetVersion(tx, { lesson, lessonId, steps });
    }),
  );

  if (error instanceof AlphabetFixLostError) {
    return null;
  }

  if (error) {
    throw error;
  }

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  return version;
}
