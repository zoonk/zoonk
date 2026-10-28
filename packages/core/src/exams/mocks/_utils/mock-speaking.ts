import "server-only";
import { getSpeakingSection } from "../../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../../language/exam-speaking/speaking-contract";
import { type MockConditions } from "../mock-contract";

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
