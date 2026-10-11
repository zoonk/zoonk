/**
 * What the learner's answers say of a skill they were taken to know: `toConfirm` while one right
 * test answer or a test-out is all there is (practice still has to confirm it), `confirmed` once a
 * right answer in practice did (or they studied its lessons, so there was nothing to take on
 * trust), and `gap` after a miss, in a test or in practice. One right answer frees a topic from its
 * lessons, never from practice: a miss there brings the lessons back, even after practice
 * confirmed it once, since its lessons were never studied (R19).
 */
export type SkillClaim = "confirmed" | "gap" | "toConfirm";

/**
 * Something that says what the learner knows of a skill: a test-out (`claim`), a lesson on it
 * finished (`studied`), a test's answer (placement, even a question of it a session asks, the focus
 * test, a chapter test, a mock taken any time), a practice answer (a session's other questions,
 * its mock included), or a test-out the learner undid (`undone`): they asked to study the skill,
 * so the answers before it no longer show they know it.
 */
export type ClaimEvent = { at: Date; skillId: string } & (
  | { kind: "claim" | "studied" | "undone" }
  | {
      isCorrect: boolean;
      kind: "practice" | "test";
      /** A true-or-false question's answer, right by luck half the time (see `meetsKnownBar`). */
      trueFalse?: boolean;
    }
);

/** One of a skill's own answers, as the known bar reads it (see `meetsKnownBar`). */
export type OwnAnswer = { isCorrect: boolean; trueFalse: boolean };

/** Right answers of its own that take a topic the learner focused on as known. */
const FOCUSED_RIGHT_ANSWERS = 2;

/** Right true-or-false answers of its own that take a topic as known: one alone is a coin flip. */
const TRUE_FALSE_RIGHT_ANSWERS = 3;

/**
 * Whether a skill's own answers show the learner knows it (R17): no miss among them, and a right
 * answer that isn't true or false (two when the learner focused on it) or three right
 * true-or-false ones. The one bar test-out, the plan's cut and the syllabus's "known" read: one
 * right true-or-false answer in a Câmara learner's first session took "Comparar sistemas
 * eleitorais" as known, and a plan short on time cut its topic first.
 */
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

/**
 * A skill's claim so far, whether the learner studied its lessons, whether a test-out skipped
 * them (`claimed`), and its own answers since the last test-out they undid (a miss always stays).
 */
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

/** What a test or practice answer makes of a skill's claim (see `readSkillClaims`). */
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

/** A skill's claim and when it began: the event that made it what it is. */
export type DatedClaim = { claim: SkillClaim; since: Date };

/** Each skill's claim state from its events in time order, with the day its claim began. */
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

/**
 * The skills the learner was taken to know without studying them: still to confirm, or confirmed
 * by practice alone. A miss on one brings its lessons back (`bringBackMissedLessons`).
 */
export function listTakenToKnow(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    [...readClaimStates(events)].flatMap(([skillId, { claim, studied }]) =>
      !studied && (claim === "toConfirm" || claim === "confirmed") ? [skillId] : [],
    ),
  );
}

/**
 * Each skill's claim from its events in time order, with the day it began (see `readSkillClaims`).
 * Skills with no claim are left out.
 */
export function readDatedClaims(events: readonly ClaimEvent[]): Map<string, DatedClaim> {
  const states = readClaimStates(events);

  return new Map(
    [...states].flatMap(([skillId, { claim, since }]) =>
      claim ? [[skillId, { claim, since }] as const] : [],
    ),
  );
}

/**
 * Each skill's claim from its events in time order. A right test answer or a test-out claims it
 * (closing an earlier gap), a right practice answer after that confirms it, and a practice miss
 * makes it a gap, confirmed or not; a wrong test answer is a gap. A skill whose lessons the learner
 * studied is no claim to take on trust: a right test answer on it later claims nothing, and
 * practice on it says nothing here (the learner model keeps its memory). Skills with neither are
 * left out.
 */
export function readSkillClaims(events: readonly ClaimEvent[]): Map<string, SkillClaim> {
  return new Map([...readDatedClaims(events)].map(([skillId, { claim }]) => [skillId, claim]));
}

/** The skills whose claim is the one given. */
export function listClaimed({
  claim,
  claims,
}: {
  claim: SkillClaim;
  claims: ReadonlyMap<string, SkillClaim>;
}): Set<string> {
  return new Set([...claims].filter(([, value]) => value === claim).map(([skillId]) => skillId));
}

/**
 * Whether the learner showed they know a skill (R17), as every reader of the learner model takes
 * it: a claim that isn't a gap, made by a test-out, by its studied lessons or by its own answers
 * (see `meetsKnownBar`), but not a skill still to confirm that they passed over by choice (a base
 * they skip, basics they said they're past), which practice has yet to confirm. One right answer
 * below the bar keeps the skill to confirm: practice asks it, and its lessons stay.
 */
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

/**
 * The skills the learner showed they know (see `isKnownClaim`), from their events: two right
 * answers of its own for a skill the learner focused on (`focused`); none is passed over by
 * default.
 */
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

/**
 * The skills a test or practice answer missed, even when a later one was right: a miss anywhere
 * means the skill isn't known yet (D2), so a plan short on time keeps it before a topic asked as
 * often (R11). The claim a later right answer makes is still `toConfirm` (see `readSkillClaims`).
 */
export function listAnsweredWrong(events: readonly ClaimEvent[]): Set<string> {
  return new Set(
    events.flatMap((event) =>
      (event.kind === "practice" || event.kind === "test") && !event.isCorrect
        ? [event.skillId]
        : [],
    ),
  );
}
