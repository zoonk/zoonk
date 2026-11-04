import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import {
  type MemoryCallInput,
  type MemoryExtractionInput,
  extractMemoryFacts,
} from "@zoonk/ai/tasks/memory/extraction";
import { findSessionPatterns } from "@zoonk/ai/tasks/memory/session-patterns";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { toProvenanceData } from "../library/_utils/library-rows";
import { isMemoryEnabled } from "./_utils/memory-access";
import {
  type MemoryCandidate,
  toMemoryCandidates,
  toSessionFacts,
} from "./_utils/memory-candidates";
import {
  type MemoryChatMessage,
  formatChatInput,
  loadOnboardingInput,
} from "./_utils/memory-source-input";
import { type MemoryChange, type MemorySource } from "./memory-contract";
import { type CandidateContext, rememberCandidate } from "./remember-candidate";

type MemoryUpdateSource =
  | { kind: "onboarding"; goalId: string }
  | { kind: "chat"; id: string | null; language: string; messages: readonly MemoryChatMessage[] }
  | { kind: "session"; id: string | null; language: string; activity: string }
  | { kind: "call"; id: string; language: string; call: Omit<MemoryCallInput, "source"> };

export type MemoryUpdateRequest = {
  userId: string;
  source: MemoryUpdateSource;
  timeZone?: string | null;
  goalId?: string | null;
};

export type ProposedMemoryUpdate = { candidates: MemoryCandidate[]; context: CandidateContext };

type ExtractionInput = {
  language: string;
  read: { source: "session"; activity: string } | MemoryExtractionInput;
  source: MemorySource;
  timeZone?: string | null;
};

function hasInput(read: ExtractionInput["read"]): boolean {
  switch (read.source) {
    case "session":
      return read.activity.trim() !== "";
    case "call":
      return read.turns.some((turn) => turn.speaker === "learner");
    case "chat":
    case "onboarding":
      return read.input.trim() !== "";
    default:
      return read satisfies never;
  }
}

async function proposeFacts({
  analytics,
  extraction,
  today,
}: {
  analytics: AiGenerationContext;
  extraction: ExtractionInput;
  today: string;
}) {
  const { language, read } = extraction;

  if (read.source === "session") {
    const { data, provenance } = await findSessionPatterns({
      activity: read.activity,
      analytics,
      language,
    });

    return { facts: toSessionFacts(data.patterns), provenance };
  }

  const { data, provenance } = await extractMemoryFacts({ ...read, analytics, language, today });

  return { facts: data.facts, provenance };
}

async function loadExtractionInput({
  source,
  userId,
}: MemoryUpdateRequest): Promise<ExtractionInput | null> {
  if (source.kind === "onboarding") {
    const onboarding = await loadOnboardingInput({ goalId: source.goalId, userId });

    return (
      onboarding && {
        language: onboarding.language,
        read: { input: onboarding.input, source: "onboarding" },
        source: { id: source.goalId, kind: "onboarding" },
        timeZone: onboarding.timeZone,
      }
    );
  }

  if (source.kind === "chat") {
    return {
      language: source.language,
      read: { input: formatChatInput(source.messages), source: "chat" },
      source: { id: source.id, kind: "chat" },
    };
  }

  if (source.kind === "call") {
    return {
      language: source.language,
      read: { ...source.call, source: "call" },
      source: { id: source.id, kind: "call" },
    };
  }

  return {
    language: source.language,
    read: { activity: source.activity, source: "session" },
    source: { id: source.id, kind: "session" },
  };
}

async function rememberInOrder({
  candidates,
  context,
}: ProposedMemoryUpdate): Promise<MemoryChange[]> {
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
 * Internal: `userId` must come from the capability or workflow a session started, never from a
 * client. Null when memory is off or there's nothing to read; a model failure throws.
 */
export async function proposeMemoryUpdate(
  request: MemoryUpdateRequest,
): Promise<ProposedMemoryUpdate | null> {
  const { goalId, timeZone, userId } = request;

  const [enabled, extraction] = await Promise.all([
    isMemoryEnabled(userId),
    loadExtractionInput(request),
  ]);

  if (!enabled || !extraction || !hasInput(extraction.read)) {
    return null;
  }

  const now = new Date();

  const zone = getAnswerTimeZone({
    goal: null,
    timeZone: timeZone ?? extraction.timeZone ?? (await getLearnerTimeZone({ userId })),
  });

  const today = getDateInTimeZone({ date: now, timeZone: zone });

  const { facts, provenance } = await proposeFacts({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goalId ?? undefined },
    extraction,
    today: today.toISOString().slice(0, 10),
  });

  return {
    candidates: toMemoryCandidates({ facts, today }),
    context: {
      language: extraction.language,
      now,
      provenance: toProvenanceData(provenance),
      source: extraction.source,
      userId,
    },
  };
}

/** `userId` must come from the capability or workflow a session started, never from a client. */
export async function updateMemoryFromActivity(
  request: MemoryUpdateRequest,
): Promise<MemoryChange[]> {
  const proposed = await proposeMemoryUpdate(request);

  if (!proposed) {
    return [];
  }

  const changes = await rememberInOrder(proposed);

  if (changes.length > 0) {
    revalidateCacheTags([getMemoryCacheTag(request.userId)]);
  }

  return changes;
}
