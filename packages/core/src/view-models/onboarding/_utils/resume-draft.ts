import "server-only";
import { prisma } from "@zoonk/db";
import { parseStoredUnderstanding } from "./onboarding-draft";

export type ResumeDraft = { draftId: string; prompt: string };

/** Abandoned drafts beyond the newest few aren't worth offering back. */
const RECENT_DRAFTS = 5;

/**
 * The learner's newest draft still waiting for an answer, offered back only while no goal is newer
 * than it or came from it: a newer goal supersedes an abandoned draft, even after archival.
 */
export async function findResumeDraft(userId: string): Promise<ResumeDraft | null> {
  const drafts = await prisma.$queryRaw<
    { id: string; prompt: string; status: string; understanding: unknown }[]
  >`
    SELECT d.id, d.prompt, d.status, d.understanding
    FROM onboarding_drafts d
    WHERE d.user_id = ${userId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM goals g
        WHERE g.user_id = d.user_id
          AND (g.created_at >= d.updated_at OR g.details->>'onboardingId' = d.id::text)
      )
    ORDER BY d.updated_at DESC
    LIMIT ${RECENT_DRAFTS}`;

  // An understood draft routed elsewhere, such as to an explanation, already has its answer.
  const open = drafts.find(
    (draft) =>
      draft.status !== "understood" ||
      parseStoredUnderstanding(draft.understanding)?.status === "goals",
  );

  return open ? { draftId: open.id, prompt: open.prompt } : null;
}
