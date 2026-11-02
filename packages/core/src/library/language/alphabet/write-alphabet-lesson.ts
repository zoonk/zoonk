import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PublishedAlphabetLesson,
  generateAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage, usesNonLatinScript } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { generateLanguageAudio } from "../../../audio/generate-language-audio";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../../_utils/plan-input-write";
import { claimLibraryGeneration, finishLibraryGeneration } from "../../claims/generation-claim";
import { toStepData } from "../../lessons/_utils/step-data";
import { createLibraryLesson } from "../../lessons/create-library-lesson";
import { startLessonVersion } from "../../lessons/lesson-versions";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { getAlphabetIdentityKey } from "./alphabet-identity";
import { ALPHABET_LESSON_MINUTES } from "./alphabet-lesson-check";
import { type AlphabetStepToSave, buildAlphabetLessonSteps } from "./alphabet-lesson-steps";

type Analytics = Parameters<typeof generateAlphabetLesson>[0]["analytics"];

const WRITE_TIER = chooseServiceTier({ reuse: "bounded", wait: "learner" });

export type WriteAlphabetLessonResult =
  | { status: "notNeeded" }
  | { lessonId: string; status: "heldBack" | "ready" | "running" }
  | {
      clips: string[];
      lesson: PublishedAlphabetLesson;
      lessonId: string;
      provenance: LibraryProvenance;
      status: "written";
    };

/** The audio texts still to voice, or none when no voice speaks the language. */
export function listAlphabetClips({
  letters,
  targetLanguage,
  voiced = new Set(),
}: {
  letters: readonly { audioText: string }[];
  targetLanguage: string;
  voiced?: Pick<ReadonlySet<string>, "has">;
}): string[] {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    return [];
  }

  const texts = new Set(letters.map((letter) => letter.audioText.trim()));
  return [...texts].filter((text) => text && !voiced.has(text));
}

/** Internal, for a workflow step: throws when the clip couldn't be made, so its step retries it. */
export async function voiceAlphabetClip({
  targetLanguage,
  text,
}: {
  targetLanguage: string;
  text: string;
}): Promise<string> {
  const { data, error } = await generateLanguageAudio({
    language: targetLanguage,
    orgSlug: AI_ORG_SLUG,
    text,
    usage: "alphabetSymbol",
  });

  if (error) {
    throw error;
  }

  return data.url;
}

/** Plans read a lesson's title, so callers lock its plan sources first. */
export async function saveAlphabetVersion(
  tx: TransactionClient,
  {
    lesson,
    lessonId,
    steps,
  }: {
    lesson: PublishedAlphabetLesson;
    lessonId: string;
    steps: readonly (AlphabetStepToSave & { provenance: LibraryProvenance })[];
  },
): Promise<number> {
  await tx.lesson.update({
    data: {
      canDo: lesson.canDo,
      description: lesson.description,
      summary: { ideas: lesson.summary.map((text) => ({ text })) },
      title: lesson.title,
    },
    where: { id: lessonId },
  });

  const version = await startLessonVersion(tx, lessonId);

  await tx.step.createMany({
    data: steps.map((step, position) => ({
      ...toStepData({
        content: step.content,
        contractVersion: STEP_CONTRACT_VERSION,
        kind: step.kind,
        position,
        provenance: step.provenance,
      }),
      lessonId,
      position,
      version,
    })),
  });

  return version;
}

class AlphabetClaimLostError extends Error {
  override name = "AlphabetClaimLostError";
}

/**
 * Internal, for a workflow step: saves the written lesson, and owes its review in the same
 * transaction. False when the run no longer holds the lesson's claim.
 */
export async function publishAlphabetLesson({
  audioUrls,
  lesson,
  lessonId,
  provenance,
  userId,
  workflowRunId,
}: {
  audioUrls: Readonly<Record<string, string>>;
  lesson: PublishedAlphabetLesson;
  lessonId: string;
  provenance: LibraryProvenance;
  userId: string;
  workflowRunId: string;
}): Promise<boolean> {
  const claim = { contentRunId: workflowRunId, contentStatus: "running" as const, id: lessonId };

  const steps = buildAlphabetLessonSteps({
    audioUrls: new Map(Object.entries(audioUrls)),
    content: lesson,
  });

  const { error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      if (!(await tx.lesson.findFirst({ select: { id: true }, where: claim }))) {
        throw new AlphabetClaimLostError();
      }

      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      const claimed = await tx.lesson.updateMany({
        data: { contentStatus: "completed", setAsideAt: null, ...toProvenanceData(provenance) },
        where: claim,
      });

      if (claimed.count === 0) {
        throw new AlphabetClaimLostError();
      }

      const version = await saveAlphabetVersion(tx, {
        lesson,
        lessonId,
        steps: steps.map((step) => ({ ...step, provenance })),
      });

      await oweFollowUps({
        db: tx,
        followUps: [{ input: { lessonId, version }, kind: "reviewAlphabetLesson" }],
        userId,
      });
    }),
  );

  if (error instanceof AlphabetClaimLostError) {
    return false;
  }

  if (error) {
    throw error;
  }

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  return true;
}

/** Internal, for a workflow step: frees the run's claim so the pair's next learner writes it. */
export async function failAlphabetLesson({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  await finishLibraryGeneration({
    id: lessonId,
    status: "failed",
    target: "lessonContent",
    workflowRunId,
  });
}

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
    serviceTier: WRITE_TIER,
    targetLanguage,
  });

  const steps = buildAlphabetLessonSteps({ audioUrls: new Map(), content: data });

  if (!steps.some((step) => step.kind === "alphabet")) {
    await failAlphabetLesson({ lessonId, workflowRunId });
    return { lessonId, status: "heldBack" };
  }

  return {
    clips: listAlphabetClips({ letters: data.letters, targetLanguage }),
    lesson: data,
    lessonId,
    provenance,
    status: "written",
  };
}

/**
 * Internal workflow bridge; callers must authorize the language pair before starting generation.
 * A `written` lesson's run holds its claim until it publishes the lesson or fails it.
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
    await failAlphabetLesson({ lessonId: lesson.id, workflowRunId });
    throw error;
  }
}
