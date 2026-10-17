import "server-only";
import { getSpeakingSection } from "../../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../../language/exam-speaking/speaking-contract";
import { type MockConditions } from "../mock-contract";

/**
 * The mock's speaking paper once the learner started its speaking section: each task's call and
 * whether it's done, and the paper's estimate once every task is graded. Null before, and for a
 * mock without one.
 */
export async function loadMockSpeaking(
  conditions: Pick<MockConditions, "sections">,
): Promise<SpeakingSectionView | null> {
  const sectionId = conditions.sections.find(
    (section) => section.speakingSectionId,
  )?.speakingSectionId;

  if (!sectionId) {
    return null;
  }

  const result = await getSpeakingSection(sectionId);
  return result.status === "ready" ? result.section : null;
}
