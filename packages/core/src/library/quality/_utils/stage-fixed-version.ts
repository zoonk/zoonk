import "server-only";
import {
  type CheckedVersion,
  citeScreensIfPossible,
  toScreensToSave,
} from "../../lessons/_utils/checked-version";
import { stageLessonVersion } from "../../lessons/_utils/save-lesson-content";
import {
  BACKGROUND_TIER,
  type PublishedDraftState,
  keepPictures,
  loadVersionSteps,
} from "./published-versions";

export async function stageFixedVersion({
  checked,
  state,
}: {
  checked: Extract<CheckedVersion, { status: "passed" }>;
  state: PublishedDraftState;
}) {
  const { context, inputs, repairBase, replaces } = state;

  const [citations, previous] = await Promise.all([
    citeScreensIfPossible({
      analytics: state.gate.analytics,
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
    language: inputs.language,
    lessonId: context.lessonId,
    repairBase,
    replaces,
    screens: keepPictures({ previous, screens }),
    summary: checked.version.lesson.summary,
  });

  return version === null
    ? { status: "replaced" as const }
    : { savedAt: Date.now(), status: "republished" as const, version };
}
