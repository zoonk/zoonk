import "server-only";
import { extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { toProvenanceData } from "../library/_utils/library-rows";
import { getMemoryAccess } from "./_utils/memory-access";
import { toMemoryCandidates } from "./_utils/memory-candidates";
import {
  type MemoryChatMessage,
  formatChatInput,
  loadOnboardingInput,
} from "./_utils/memory-source-input";
import { type CandidateContext, rememberCandidate } from "./_utils/remember-candidate";
import { type MemoryChange, type MemorySource } from "./memory-contract";

type MemoryUpdateSource =
  | { kind: "onboarding"; goalId: string }
  | { kind: "chat"; id: string | null; language: string; messages: readonly MemoryChatMessage[] }
  | { kind: "session"; id: string | null; language: string; activity: string };

export type MemoryUpdateRequest = {
  userId: string;
  source: MemoryUpdateSource;
  /** The learner's timezone, to date facts like "my exam is next Friday". */
  timeZone?: string | null;
  goalId?: string | null;
};

type ExtractionInput = { input: string; language: string; source: MemorySource };

async function loadExtractionInput({
  source,
  userId,
}: MemoryUpdateRequest): Promise<ExtractionInput | null> {
  if (source.kind === "onboarding") {
    const onboarding = await loadOnboardingInput({ goalId: source.goalId, userId });
    return onboarding && { ...onboarding, source: { id: source.goalId, kind: "onboarding" } };
  }

  if (source.kind === "chat") {
    const input = formatChatInput(source.messages);
    return { input, language: source.language, source: { id: source.id, kind: "chat" } };
  }

  return {
    input: source.activity,
    language: source.language,
    source: { id: source.id, kind: "session" },
  };
}

async function rememberInOrder({
  candidates,
  context,
}: {
  candidates: Parameters<typeof rememberCandidate>[0]["candidate"][];
  context: CandidateContext;
}): Promise<MemoryChange[]> {
  const changes: MemoryChange[] = [];

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop -- Each candidate must see what the previous one changed.
    const change = await rememberCandidate({ candidate, context });

    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

/**
 * Learns from what the learner said or did: after onboarding, a chat or a study session, a cheap
 * model proposes lasting facts, a classifier drops passing and sensitive ones, and each survivor is
 * compared with related facts to be added, replace one, remove one or be ignored. Returns what
 * changed, so a chat can show "Memory updated" with undo. Nothing is learned while memory is off,
 * and minors' memory keeps only goals and learning.
 *
 * This is a bridge for chats and workflows: `userId` comes from the public capability or workflow
 * that a session started, never from a client.
 */
export async function updateMemoryFromActivity(
  request: MemoryUpdateRequest,
): Promise<MemoryChange[]> {
  const { goalId, timeZone, userId } = request;

  const [access, extraction] = await Promise.all([
    getMemoryAccess(userId),
    loadExtractionInput(request),
  ]);

  if (!access.enabled || !extraction?.input.trim()) {
    return [];
  }

  const now = new Date();
  const zone = getAnswerTimeZone({ goal: null, timeZone });
  const today = getDateInTimeZone({ date: now, timeZone: zone });

  const { data, provenance } = await extractMemoryFacts({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goalId ?? undefined },
    categories: access.categories,
    input: extraction.input,
    language: extraction.language,
    source: extraction.source.kind,
    today: today.toISOString().slice(0, 10),
  });

  const candidates = toMemoryCandidates({
    categories: access.categories,
    facts: data.facts,
    source: extraction.source.kind,
    today,
  });

  const changes = await rememberInOrder({
    candidates,
    context: {
      access,
      language: extraction.language,
      now,
      provenance: toProvenanceData(provenance),
      source: extraction.source,
      userId,
    },
  });

  if (changes.length > 0) {
    revalidateCacheTags([getMemoryCacheTag(userId)]);
  }

  return changes;
}

/**
 * Runs `updateMemoryFromActivity` after the response is sent, for onboarding and sessions where
 * nobody waits for the result. A failure is logged and memory stays as it was.
 */
export function scheduleMemoryUpdate(request: MemoryUpdateRequest): void {
  after(async () => {
    const { error } = await safeAsync(() => updateMemoryFromActivity(request));

    if (error) {
      logError(`Could not update memory for learner ${request.userId}.`, error);
    }
  });
}
