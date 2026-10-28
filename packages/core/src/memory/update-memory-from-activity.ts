import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { findSessionPatterns } from "@zoonk/ai/tasks/v2/memory/session-patterns";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { toProvenanceData } from "../library/_utils/library-rows";
import { isMemoryEnabled } from "./_utils/memory-access";
import { toMemoryCandidates, toSessionFacts } from "./_utils/memory-candidates";
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
  timeZone?: string | null;
  goalId?: string | null;
};

type ExtractionInput = { input: string; language: string; source: MemorySource };

async function proposeFacts({
  analytics,
  extraction,
  today,
}: {
  analytics: AiGenerationContext;
  extraction: ExtractionInput;
  today: string;
}) {
  const { input, language, source } = extraction;

  if (source.kind === "session") {
    const { data, provenance } = await findSessionPatterns({
      activity: input,
      analytics,
      language,
    });

    return { facts: toSessionFacts(data.patterns), provenance };
  }

  const { data, provenance } = await extractMemoryFacts({
    analytics,
    input,
    language,
    source: source.kind,
    today,
  });

  return { facts: data.facts, provenance };
}

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

/** `userId` must come from the capability or workflow a session started, never from a client. */
export async function updateMemoryFromActivity(
  request: MemoryUpdateRequest,
): Promise<MemoryChange[]> {
  const { goalId, timeZone, userId } = request;

  const [enabled, extraction] = await Promise.all([
    isMemoryEnabled(userId),
    loadExtractionInput(request),
  ]);

  if (!enabled || !extraction?.input.trim()) {
    return [];
  }

  const now = new Date();
  const zone = getAnswerTimeZone({ goal: null, timeZone });
  const today = getDateInTimeZone({ date: now, timeZone: zone });

  const { facts, provenance } = await proposeFacts({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goalId ?? undefined },
    extraction,
    today: today.toISOString().slice(0, 10),
  });

  const candidates = toMemoryCandidates({ facts, today });

  const changes = await rememberInOrder({
    candidates,
    context: {
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

/** Never throws: it runs after the response and logs a failure. */
export function scheduleMemoryUpdate(request: MemoryUpdateRequest): void {
  after(async () => {
    const { error } = await safeAsync(() => updateMemoryFromActivity(request));

    if (error) {
      logError(`Could not update memory for learner ${request.userId}.`, error);
    }
  });
}
