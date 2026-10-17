import "server-only";
import { sql } from "@zoonk/db";
import { getSpeakingSection } from "../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../language/exam-speaking/speaking-contract";
import { startSpeakingSection } from "../../language/exam-speaking/start-speaking-section";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { findOwnedMock } from "./_utils/owned-mock";

export type StartMockSpeakingResult =
  | { section: SpeakingSectionView; status: "ready" }
  | { status: "callsPaused" | "notFound" | "notSpeaking" | "plusRequired" | "unauthorized" };

/** The paper another tap kept on the mock first; the one just written if none is there. */
async function loadKeptPaper({
  blockId,
  fallback,
}: {
  blockId: string;
  fallback: StartMockSpeakingResult;
}): Promise<StartMockSpeakingResult> {
  const found = await findOwnedMock(blockId);
  const mock = found.status === "ready" ? found.owned.mock : null;
  const sectionId = mock?.conditions.sections[mock.sectionIndex]?.speakingSectionId;

  return sectionId ? getSpeakingSection(sectionId) : fallback;
}

/**
 * Starts the running mock's speaking section once the learner reaches it: the exam's speaking
 * paper, every task's card written now (`startSpeakingSection`), each task a live call with the
 * examiner. The paper is kept on the mock, so a reload or a second tap opens the same one instead
 * of writing another. Only the section the mock is on, while it runs.
 */
export async function startMockSpeaking({
  blockId,
}: {
  blockId: string;
}): Promise<StartMockSpeakingResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { goal, mock } = found.owned;
  const section = mock?.conditions.sections[mock.sectionIndex];

  if (!mock || !goal || mock.status !== "active" || section?.kind !== "speaking") {
    return { status: "notSpeaking" };
  }

  if (section.speakingSectionId) {
    const kept = await getSpeakingSection(section.speakingSectionId);
    return kept.status === "ready" ? kept : { status: "notFound" };
  }

  const started = await startSpeakingSection({ goalId: goal.id });

  if (started.status !== "ready") {
    return { status: started.status === "notLanguage" ? "notSpeaking" : started.status };
  }

  // Only the paper's id changes, and only while the section has none: two taps at once keep the
  // first paper, and the second learns of it.
  const index = String(mock.sectionIndex);

  const kept = await writeLearnerChange({ userId: found.owned.userId }, async (tx) => {
    const count = await tx.$executeRaw(sql`
    UPDATE mock_exams
    SET conditions = jsonb_set(conditions, ARRAY['sections', ${index}, 'speakingSectionId'], to_jsonb(${started.section.id}::text)),
        updated_at = now()
    WHERE id = ${mock.id}::uuid
      AND status = 'active'
      AND section_index = ${mock.sectionIndex}
      AND conditions -> 'sections' -> ${mock.sectionIndex}::int ->> 'speakingSectionId' IS NULL
  `);

    return count > 0 ? count : unchanged(count);
  });

  return kept > 0 ? started : loadKeptPaper({ blockId, fallback: started });
}
