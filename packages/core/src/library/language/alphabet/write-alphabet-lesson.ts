import "server-only";
import { generateAlphabetLesson } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { prisma } from "@zoonk/db";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { generateLanguageAudio } from "../../../audio/generate-language-audio";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { claimLibraryGeneration, finishLibraryGeneration } from "../../claims/generation-claim";
import { toStepData } from "../../lessons/_utils/step-data";
import { createLibraryLesson } from "../../lessons/create-library-lesson";
import { startLessonVersion } from "../../lessons/lesson-versions";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { getAlphabetIdentityKey } from "./alphabet-identity";
import { type AlphabetStepToSave, buildAlphabetLessonSteps } from "./alphabet-lesson-steps";

type Analytics = Parameters<typeof generateAlphabetLesson>[0]["analytics"];

/** About how long reading a handful of letter cards with their sounds takes. */
const ALPHABET_LESSON_MINUTES = 5;

export type WriteAlphabetLessonResult =
  | { status: "notNeeded" }
  | { lessonId: string; status: "heldBack" | "published" | "ready" | "running" };

type LessonUpdate = Awaited<ReturnType<typeof generateAlphabetLesson>>["data"];

/** Each unique clip once; a clip that fails leaves its card without audio rather than the lesson. */
async function voiceLetters({
  content,
  targetLanguage,
}: {
  content: LessonUpdate;
  targetLanguage: string;
}): Promise<Map<string, string>> {
  const texts = [...new Set(content.letters.map((letter) => letter.audioText.trim()))].filter(
    Boolean,
  );

  const clips = await Promise.all(
    texts.map(async (text) => {
      const { data } = await generateLanguageAudio({
        language: targetLanguage,
        orgSlug: AI_ORG_SLUG,
        text,
        usage: "alphabetSymbol",
      });

      return data ? ([text, data.url] as const) : null;
    }),
  );

  return new Map(clips.filter((clip) => clip !== null));
}

/** Publishes the lesson's screens while this run holds its claim; false when it lost it. */
async function saveAlphabetLesson({
  content,
  lessonId,
  provenance,
  steps,
  workflowRunId,
}: {
  content: LessonUpdate;
  lessonId: string;
  provenance: LibraryProvenance;
  steps: readonly AlphabetStepToSave[];
  workflowRunId: string;
}): Promise<boolean> {
  const saved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lesson.updateMany({
      data: {
        canDo: content.canDo,
        contentStatus: "completed",
        description: content.description,
        summary: { ideas: content.summary.map((text) => ({ text })) },
        title: content.title,
        ...toProvenanceData(provenance),
      },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      return false;
    }

    const version = await startLessonVersion(tx, lessonId);

    await tx.step.createMany({
      data: steps.map((step, position) => ({
        ...toStepData({
          content: step.content,
          contractVersion: STEP_CONTRACT_VERSION,
          kind: step.kind,
          position,
          provenance,
        }),
        lessonId,
        position,
        version,
      })),
    });

    return true;
  });

  if (saved) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return saved;
}

/** The pair's lesson outline, found or created, until the run that claims it writes it. */
async function findOrCreateAlphabetLesson({
  learnerLanguage,
  targetLanguage,
  workflowRunId,
}: {
  learnerLanguage: string;
  targetLanguage: string;
  workflowRunId: string;
}) {
  const { lesson } = await createLibraryLesson({
    description: "",
    estimatedMinutes: ALPHABET_LESSON_MINUTES,
    homeChapterId: null,
    identityKey: getAlphabetIdentityKey(targetLanguage),
    language: learnerLanguage,
    level: "beginner",
    ownerId: null,
    provenance: {
      generatedAt: new Date(),
      model: "pending",
      promptVersion: "pending",
      runId: workflowRunId,
    },
    skillIds: [],
    targetLanguage,
    title: getAlphabetIdentityKey(targetLanguage),
  });

  return lesson;
}

/** Writes the claimed lesson: its content, a clip per letter and its screens. */
async function writeClaimedLesson({
  analytics,
  learnerLanguage,
  lessonId,
  targetLanguage,
  workflowRunId,
}: {
  analytics?: Analytics;
  learnerLanguage: string;
  lessonId: string;
  targetLanguage: string;
  workflowRunId: string;
}): Promise<WriteAlphabetLessonResult> {
  const { data, provenance } = await generateAlphabetLesson({
    analytics: { contentScope: "shared", traceId: workflowRunId, ...analytics },
    learnerLanguage,
    targetLanguage,
  });

  const audioUrls = await voiceLetters({ content: data, targetLanguage });
  const steps = buildAlphabetLessonSteps({ audioUrls, content: data });

  if (!steps.some((step) => step.kind === "alphabet")) {
    await finishLibraryGeneration({
      id: lessonId,
      status: "failed",
      target: "lessonContent",
      workflowRunId,
    });

    return { lessonId, status: "heldBack" };
  }

  const saved = await saveAlphabetLesson({
    content: data,
    lessonId,
    provenance,
    steps,
    workflowRunId,
  });

  return { lessonId, status: saved ? "published" : "running" };
}

/**
 * Writes the alphabet lesson a new learner's first session opens with, for a language whose
 * script isn't Latin: one shared lesson per script and learner language, reused by every learner
 * of that pair. The first run to claim it writes the intro, letter cards with their clips,
 * matches and summary; later runs find it ready or being written. A draft without letters is held back so a
 * later run tries again, and so is a failed run's claim.
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is
 * written.
 */
export async function writeAlphabetLesson({
  analytics,
  learnerLanguage,
  targetLanguage,
  workflowRunId,
}: {
  analytics?: Analytics;
  learnerLanguage: string;
  targetLanguage: string;
  workflowRunId: string;
}): Promise<WriteAlphabetLessonResult> {
  if (!usesNonLatinScript(targetLanguage)) {
    return { status: "notNeeded" };
  }

  const lesson = await findOrCreateAlphabetLesson({
    learnerLanguage,
    targetLanguage,
    workflowRunId,
  });

  const claim = await claimLibraryGeneration({
    id: lesson.id,
    target: "lessonContent",
    workflowRunId,
  });

  if (claim !== "claimed") {
    return { lessonId: lesson.id, status: claim === "completed" ? "ready" : "running" };
  }

  try {
    return await writeClaimedLesson({
      analytics,
      learnerLanguage,
      lessonId: lesson.id,
      targetLanguage,
      workflowRunId,
    });
  } catch (error) {
    // A failed claim can be taken again, by this step's retry or the pair's next learner.
    await finishLibraryGeneration({
      id: lesson.id,
      status: "failed",
      target: "lessonContent",
      workflowRunId,
    });

    throw error;
  }
}
