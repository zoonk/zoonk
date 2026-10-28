import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { loadSpeakingSection } from "./_utils/load-speaking-section";
import { type SpeakingSectionView } from "./speaking-contract";

export type SpeakingSectionResult =
  | { section: SpeakingSectionView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

export async function getSpeakingSection(sectionId: string): Promise<SpeakingSectionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const section = isUuid(sectionId)
    ? await loadSpeakingSection({ sectionId, userId: session.user.id })
    : null;

  return section ? { section, status: "ready" } : { status: "notFound" };
}
