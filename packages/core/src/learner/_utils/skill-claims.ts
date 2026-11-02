/** One test answer can skip lessons but still needs practice confirmation; a later miss reopens the gap. */
export type SkillClaim = "confirmed" | "gap" | "toConfirm";

/** undone invalidates earlier evidence of knowing the skill; session placement answers remain tests. */
export type ClaimEvent = { at: Date; skillId: string } & (
  | { kind: "claim" | "studied" | "undone" }
  | { isCorrect: boolean; kind: "practice" | "test"; trueFalse?: boolean }
);

export type OwnAnswer = { isCorrect: boolean; trueFalse: boolean };

const FOCUSED_RIGHT_ANSWERS = 2;

/** One true-or-false answer can be right by chance. */
const TRUE_FALSE_RIGHT_ANSWERS = 3;

export function meetsKnownBar({
  answers,
  focused,
}: {
  answers: readonly OwnAnswer[];
  focused: boolean;
}): boolean {
  const right = answers.filter((answer) => answer.isCorrect);
  const rightTrueFalse = right.filter((answer) => answer.trueFalse).length;
  const needed = focused ? FOCUSED_RIGHT_ANSWERS : 1;

  return (
    answers.every((answer) => answer.isCorrect) &&
    (right.length - rightTrueFalse >= needed || rightTrueFalse >= TRUE_FALSE_RIGHT_ANSWERS)
  );
}

type ClaimState = {
  answers: OwnAnswer[];
  claim: SkillClaim | undefined;
  claimed: boolean;
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
      answers: current.answers.filter((answer) => !answer.isCorrect),
      claimed: false,
    };
  }

  if (event.kind === "practice" || event.kind === "test") {
    const answers = [
      ...current.answers,
      { isCorrect: event.isCorrect, trueFalse: event.trueFalse === true },
    ];

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
        since: event.at,
        studied: false,
      };

      const next = nextClaim({ current, event });
      const since = next.claim === current.claim ? current.since : event.at;

      return all.set(event.skillId, { ...next, since });
    }, new Map<string, ClaimState & { since: Date }>());
}

export function listTakenToKnow(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, { claim, studied }]) =>
      !studied && (claim === "toConfirm" || claim === "confirmed") ? [skillId] : [],
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

function isKnownClaim({
  focused,
  passedOver,
  state,
}: {
  focused: boolean;
  passedOver: boolean;
  state: ClaimState;
}): boolean {
  const { claim } = state;

  return (
    claim !== undefined &&
    claim !== "gap" &&
    !(claim === "toConfirm" && passedOver) &&
    (state.studied || state.claimed || meetsKnownBar({ answers: state.answers, focused }))
  );
}

/** focused requires two right answers of the skill's own; passedOver is false by default. */
export function listKnownSkills({
  events,
  focused = () => false,
  passedOver = () => false,
}: {
  events: readonly ClaimEvent[];
  focused?: (skillId: string) => boolean;
  passedOver?: (skillId: string) => boolean;
}): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, state]) =>
      isKnownClaim({ focused: focused(skillId), passedOver: passedOver(skillId), state })
        ? [skillId]
        : [],
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
