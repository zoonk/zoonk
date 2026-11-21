import { type ItemFormat } from "@zoonk/db";
import { isLowGuessTap, isQuickChoice } from "./placement-guess-rate";

/** Test answers can skip lessons but still need practice confirmation; a later miss reopens the gap. */
export type SkillClaim = "confirmed" | "gap" | "toConfirm";

export type OwnAnswer = {
  content?: unknown;
  format: ItemFormat;
  isCorrect: boolean;
  itemId: string | null;
  localDate?: Date;
};

type SkillEvidence = OwnAnswer | { undoneOn: Date };

export type ClaimEvent = { at: Date; skillId: string } & (
  | { kind: "claim" | "studied" | "undone"; localDate?: Date }
  | ({ kind: "practice" | "test"; isCorrect: boolean; recheck?: boolean } & Partial<
      Omit<OwnAnswer, "isCorrect">
    >)
);

function canConfirm(answer: OwnAnswer) {
  return (
    answer.format === "typed" ||
    answer.format === "numeric" ||
    answer.format === "spoken" ||
    isLowGuessTap(answer)
  );
}

/** Reads first unaided answers in chronological order. */
export function isSkillConfirmed({ answers }: { answers: readonly SkillEvidence[] }): boolean {
  const seen = new Set<string>();

  const independent = answers.filter((answer) => {
    if ("undoneOn" in answer) {
      return true;
    }

    if (!answer.itemId || seen.has(answer.itemId)) {
      return false;
    }

    seen.add(answer.itemId);
    return true;
  });

  const reset = independent.findLastIndex((answer) => "undoneOn" in answer || !answer.isCorrect);
  const blocker = independent[reset];
  const blockedOn = blocker && ("undoneOn" in blocker ? blocker.undoneOn : blocker.localDate);

  const fresh = independent
    .slice(reset + 1)
    .filter((answer): answer is OwnAnswer => !("undoneOn" in answer));

  const quick = fresh.filter((answer) => isQuickChoice(answer));
  const lowGuess = fresh.filter((answer) => canConfirm(answer));

  return (
    quick.length > 0 &&
    lowGuess.length >= 3 &&
    (reset === -1 ||
      (blockedOn !== undefined &&
        [...quick, ...lowGuess].some((answer) => answer.localDate && answer.localDate > blockedOn)))
  );
}

type ClaimState = {
  answers: SkillEvidence[];
  claim: SkillClaim | undefined;
  claimed: boolean;
  pendingRecheck: Date | null;
  studied: boolean;
};

function nextClaim({ current, event }: { current: ClaimState; event: ClaimEvent }): ClaimState {
  const { claim, studied } = current;

  if (event.kind === "studied") {
    return { ...current, claim: claim === "gap" ? claim : "confirmed", studied: true };
  }

  if (event.kind === "undone") {
    return {
      ...current,
      answers: [...current.answers, { undoneOn: event.localDate ?? event.at }],
      claimed: false,
      pendingRecheck: null,
    };
  }

  if (event.kind === "practice" || event.kind === "test") {
    const answers = [
      ...current.answers,
      { ...event, format: event.format ?? "multipleChoice", itemId: event.itemId ?? null },
    ];

    if (event.recheck) {
      return {
        ...current,
        answers,
        claim: event.isCorrect ? "confirmed" : "gap",
        claimed: current.claimed && event.isCorrect,
        pendingRecheck: null,
      };
    }

    if (current.claimed && !studied && !event.isCorrect) {
      return {
        ...current,
        answers,
        pendingRecheck:
          event.kind === "practice"
            ? (current.pendingRecheck ?? event.localDate ?? event.at)
            : current.pendingRecheck,
      };
    }

    return { ...current, answers, claim: getAnswerClaim({ claim, event, studied }) };
  }

  const claimed = { ...current, claimed: true };
  return studied || claim === "confirmed" ? claimed : { ...claimed, claim: "toConfirm" };
}

function getAnswerClaim({
  claim,
  event,
  studied,
}: {
  claim: SkillClaim | undefined;
  event: Extract<ClaimEvent, { kind: "practice" | "test" }>;
  studied: boolean;
}): SkillClaim | undefined {
  if (event.kind === "test") {
    if (!event.isCorrect) {
      return "gap";
    }

    return studied || claim === "confirmed" ? "confirmed" : "toConfirm";
  }

  if (studied || claim === undefined) {
    return claim;
  }

  if (!event.isCorrect) {
    return "gap";
  }

  return claim === "toConfirm" ? "confirmed" : claim;
}

export type DatedClaim = { claim: SkillClaim; since: Date };

function readClaimStates(events: readonly ClaimEvent[]) {
  return events
    .toSorted((a, b) => a.at.getTime() - b.at.getTime())
    .reduce((all, event) => {
      const current = all.get(event.skillId) ?? {
        answers: [],
        claim: undefined,
        claimed: false,
        pendingRecheck: null,
        since: event.at,
        studied: false,
      };

      const next = nextClaim({ current, event });
      const since = next.claim === current.claim ? current.since : event.at;

      return all.set(event.skillId, { ...next, since });
    }, new Map<string, ClaimState & { since: Date }>());
}

export function listSkippedRechecks({
  events,
  localDate,
}: {
  events: readonly ClaimEvent[];
  localDate: Date;
}): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, state]) =>
      state.pendingRecheck && state.pendingRecheck < localDate ? [skillId] : [],
    ),
  );
}

export function listConfirmedSkills(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, state]) =>
      isSkillConfirmed({ answers: state.answers }) ? [skillId] : [],
    ),
  );
}

export function listTakenToKnow(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, state]) =>
      !state.studied && isKnownClaim({ passedOver: false, state }) ? [skillId] : [],
    ),
  );
}

/** Omits skills with no claim. */
export function readDatedClaims(events: readonly ClaimEvent[]): Map<string, DatedClaim> {
  const states = readClaimStates(events);

  return new Map(
    [...states].flatMap(([skillId, { claim, since }]) =>
      claim ? [[skillId, { claim, since }] as const] : [],
    ),
  );
}

/** Studied skills have no claim to take on trust; practice misses reopen unstudied claims even after confirmation. */
export function readSkillClaims(events: readonly ClaimEvent[]): Map<string, SkillClaim> {
  return new Map([...readDatedClaims(events)].map(([skillId, { claim }]) => [skillId, claim]));
}

export function listClaimed({
  claim,
  claims,
}: {
  claim: SkillClaim;
  claims: ReadonlyMap<string, SkillClaim>;
}): Set<string> {
  return new Set([...claims].filter(([, value]) => value === claim).map(([skillId]) => skillId));
}

function isKnownClaim({ passedOver, state }: { passedOver: boolean; state: ClaimState }): boolean {
  const { claim } = state;

  return (
    claim !== undefined &&
    claim !== "gap" &&
    !(claim === "toConfirm" && passedOver) &&
    (state.studied || state.claimed || isSkillConfirmed({ answers: state.answers }))
  );
}

export function listKnownSkills({
  events,
  passedOver = () => false,
}: {
  events: readonly ClaimEvent[];
  passedOver?: (skillId: string) => boolean;
}): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, state]) =>
      isKnownClaim({ passedOver: passedOver(skillId), state }) ? [skillId] : [],
    ),
  );
}

/** Includes every miss even if a later answer was right. */
export function listAnsweredWrong(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    events.flatMap((event) =>
      (event.kind === "practice" || event.kind === "test") && !event.isCorrect
        ? [event.skillId]
        : [],
    ),
  );
}
