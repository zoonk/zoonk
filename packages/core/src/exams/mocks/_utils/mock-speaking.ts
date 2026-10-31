import "server-only";
import { getSpeakingSection } from "../../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../../language/exam-speaking/speaking-contract";
import { type MockSitting } from "./owned-mock";

/** A paper written ahead shows once the learner reaches its section, not while they sit earlier ones. */
export async function loadMockSpeaking(
  mock: Pick<MockSitting, "conditions" | "sectionIndex"> | null,
): Promise<SpeakingSectionView | null> {
  const sectionId = mock?.conditions.sections
    .slice(0, mock.sectionIndex + 1)
    .find((section) => section.speakingSectionId)?.speakingSectionId;

  if (!sectionId) {
    return null;
  }

  const result = await getSpeakingSection(sectionId);
  return result.status === "ready" ? result.section : null;
}
