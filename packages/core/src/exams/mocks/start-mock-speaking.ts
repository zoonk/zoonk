import "server-only";
import { prisma } from "@zoonk/db";
import { readLiveCallAdmission } from "../../language/conversations/_utils/live-call-policy";
import { type PreparingCall } from "../../language/conversations/call-writing-contract";
import {
  findExamSpeakingSetup,
  hasSpeakingAccess,
} from "../../language/exam-speaking/_utils/exam-speaking-setup";
import { getSpeakingSection } from "../../language/exam-speaking/get-speaking-section";
import { type SpeakingSectionView } from "../../language/exam-speaking/speaking-contract";
import { findOwnedMock } from "./_utils/owned-mock";

export type StartMockSpeakingResult =
  | PreparingCall
  | { section: SpeakingSectionView; status: "ready" }
  | { status: "callsPaused" | "notFound" | "notSpeaking" | "plusRequired" | "unauthorized" };

/** The paper is written from the mock's start; one not written yet comes back as a writing to wait on. */
export async function startMockSpeaking({
  blockId,
}: {
  blockId: string;
}): Promise<StartMockSpeakingResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { goal, mock, userId } = found.owned;
  const section = mock?.conditions.sections[mock.sectionIndex];

  if (!mock || !goal || mock.status !== "active" || section?.kind !== "speaking") {
    return { status: "notSpeaking" };
  }

  if (section.speakingSectionId) {
    const kept = await getSpeakingSection(section.speakingSectionId);
    return kept.status === "ready" ? kept : { status: "notFound" };
  }

  if (!(await findExamSpeakingSetup({ goalId: goal.id, userId }))) {
    return { status: "notSpeaking" };
  }

  if (!(await hasSpeakingAccess())) {
    return { status: "plusRequired" };
  }

  if ((await readLiveCallAdmission({ transaction: prisma, userId })) === null) {
    return { status: "callsPaused" };
  }

  return { status: "preparing", writing: { kind: "speakingPaper", mockId: mock.id, userId } };
}
