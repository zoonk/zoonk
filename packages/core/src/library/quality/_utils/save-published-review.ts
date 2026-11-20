import "server-only";
import {
  type CheckedVersion,
  type GateResult,
  citeScreensIfPossible,
  toScreensToSave,
} from "../../lessons/_utils/checked-version";
import { type LessonWritingInputs } from "../../lessons/_utils/lesson-writing-inputs";
import { stageLessonVersion } from "../../lessons/_utils/save-lesson-content";
import { recordLessonQualityDecision } from "../lesson-quality-decision";
import {
  BACKGROUND_TIER,
  type CheckContext,
  type PublishedDraftState,
  keepPictures,
  loadVersionSteps,
  toTaskAnalytics,
} from "./published-versions";

export function writerRunIdOf(state: PublishedDraftState) {
  return state.writerRunId ?? state.version.provenanceByScreen[0]?.runId;
}

export function recordPublishedReview({
  checked,
  phase,
  needsFix,
  state,
}: {
  checked: Pick<GateResult, "blocking" | "minor" | "reviewerRunId">;
  phase: "firstReview" | "recheck";
  needsFix: boolean;
  state: PublishedDraftState;
}) {
  const failedOutcome = phase === "recheck" ? "heldBack" : "needsFix";
  const writerRunId = writerRunIdOf(state);
  const version = state.live ? state.replaces : undefined;

  return recordLessonQualityDecision({
    evidence: writerRunId
      ? {
          attemptKey: state.live ? `version:${state.replaces}:${writerRunId}` : writerRunId,
          blocking: checked.blocking,
          minor: checked.minor,
          phase,
          reviewerRunId: checked.reviewerRunId,
          writerRunId,
        }
      : undefined,
    lessonId: state.context.lessonId,
    outcome: needsFix ? failedOutcome : "passed",
    version,
  });
}

export async function stageFixedVersion({
  checked,
  context,
  inputs,
  replaces,
  writerRunId,
}: {
  checked: Extract<CheckedVersion, { status: "passed" }>;
  context: CheckContext;
  inputs: LessonWritingInputs;
  replaces: number;
  writerRunId?: string;
}): Promise<{ status: "replaced" } | { savedAt: number; status: "republished"; version: number }> {
  const [citations, previous] = await Promise.all([
    citeScreensIfPossible({
      analytics: await toTaskAnalytics(context),
      inputs,
      lesson: checked.version.lesson,
      serviceTier: BACKGROUND_TIER,
    }),
    loadVersionSteps({ lessonId: context.lessonId, version: replaces }),
  ]);

  const screens = toScreensToSave({
    citations,
    inputs,
    screens: checked.screens,
    version: checked.version,
  });

  const version = await stageLessonVersion({
    evidence: writerRunId
      ? { attemptKey: writerRunId, phase: "disposition", writerRunId }
      : undefined,
    language: inputs.language,
    lessonId: context.lessonId,
    replaces,
    screens: keepPictures({ previous, screens }),
    summary: checked.version.lesson.summary,
  });

  return version === null
    ? { status: "replaced" }
    : { savedAt: Date.now(), status: "republished", version };
}
