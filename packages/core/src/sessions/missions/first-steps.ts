import { type Goal } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type EntitlementTier } from "../../entitlements/contract";
import { type SessionPlanItem } from "../_utils/session-plan-item";
import { type FirstStepKind, type MissionOpens, type MissionPick } from "./catalog";
import { loadFirstStepHistory } from "./first-step-history";

type FirstStep = {
  kind: FirstStepKind;
  opens?: MissionOpens;
  status: "done" | "today" | "available" | "later";
  /** Why the block it opens can't start yet, as a mission's `waitReason` says. */
  waitReason?: "challenge" | "lessons";
  when?:
    | { kind: "challenge" | "essay"; date?: string }
    | { kind: "mistake" | "review" | "pattern" | "call" | "buddy" | "lesson" | "mock" };
};

export type FirstSteps = {
  /**
   * The learner-local day ("YYYY-MM-DD") the last step was done, while it's still that day: the
   * finished list says so, then retires the next day.
   */
  completedOn?: string;
  done: number;
  steps: FirstStep[];
  total: number;
};

/** When each step was first done, from the learner's history; one never done has no date. */
type DoneAt = Partial<Record<FirstStepKind, Date>>;

/** The learner-local day the list's last step was first done, as "YYYY-MM-DD". */
function getCompletedOn({
  doneAt,
  kinds,
  timeZone,
}: {
  doneAt: DoneAt;
  kinds: readonly FirstStepKind[];
  timeZone: string;
}): string | null {
  const times = kinds.map((kind) => doneAt[kind]?.getTime());

  if (times.some((time) => time === undefined)) {
    return null;
  }

  const last = new Date(Math.max(...times.filter((time) => time !== undefined)));
  return toIsoDate(getDateInTimeZone({ date: last, timeZone }));
}

/** A UTC-midnight day label as "YYYY-MM-DD". */
function toIsoDate(day: Date): string {
  return day.toISOString().slice(0, "YYYY-MM-DD".length);
}

function firstStepKinds({
  goal,
  hasChallenges,
  hasEssays,
  tier,
}: {
  goal: Goal;
  hasChallenges: boolean;
  hasEssays: boolean;
  tier: EntitlementTier;
}): FirstStepKind[] {
  return [
    "somethingNew",
    "review",
    goal.kind === "language" ? "pattern" : "fixMistake",
    tier !== "guest" && "askBuddy",
    goal.kind === "exam" && hasEssays && "essay",
    goal.kind === "language" && tier !== "guest" && "call",
    goal.kind === "exam" && tier === "plus" && "mock",
    hasChallenges && "challenge",
  ].filter((kind): kind is FirstStepKind => Boolean(kind));
}

function toStep({
  candidates,
  doneAt,
  items,
  kind,
}: {
  candidates: readonly MissionPick[];
  doneAt: DoneAt;
  items: readonly SessionPlanItem[];
  kind: FirstStepKind;
}): FirstStep {
  if (doneAt[kind]) {
    return { kind, status: "done" };
  }

  const pick = candidates.find(
    (candidate) =>
      candidate.kind === kind || (kind === "somethingNew" && candidate.kind === "finishChapter"),
  );

  if (pick) {
    return { kind, ...(pick.opens ? { opens: pick.opens } : {}), status: "available" };
  }

  if (kind === "mock") {
    return { kind, opens: { kind: "mockChooser" }, status: "available" };
  }

  const firstChallenge =
    kind === "challenge"
      ? items.find((item) => item.status === "todo" && ["boss", "checkpoint"].includes(item.kind))
      : undefined;

  const when = unavailableStepWhen({ firstChallenge, kind });
  return { kind, status: "later", when };
}

function unavailableStepWhen({
  firstChallenge,
  kind,
}: {
  firstChallenge: SessionPlanItem | undefined;
  kind: FirstStepKind;
}): FirstStep["when"] {
  if (kind === "challenge") {
    return {
      kind,
      ...(firstChallenge?.scheduledFor
        ? { date: firstChallenge.scheduledFor.toISOString().slice(0, 10) }
        : {}),
    };
  }

  if (kind === "fixMistake") {
    return { kind: "mistake" };
  }

  if (kind === "somethingNew") {
    return { kind: "lesson" };
  }

  return { kind: kind === "askBuddy" ? "buddy" : kind };
}

/** Internal: the caller already derived the learner and owned goal at an authenticated boundary. */
export async function loadFirstSteps({
  candidates,
  goal,
  hasEssays,
  items,
  now,
  tier,
  timeZone,
  userId,
}: {
  candidates: readonly MissionPick[];
  goal: Goal;
  hasEssays: boolean;
  items: readonly SessionPlanItem[];
  /** The moment of the read: its calendar day in `timeZone`, not a carried session's, keeps a finished list. */
  now: Date;
  tier: EntitlementTier;
  timeZone: string;
  userId: string;
}): Promise<FirstSteps | null> {
  const history = await loadFirstStepHistory(userId);

  if (history.retired || history.firstGoalId !== goal.id || goal.kind === "explain") {
    return null;
  }

  const kinds = firstStepKinds({
    goal,
    hasChallenges: items.some((item) => ["boss", "checkpoint"].includes(item.kind)),
    hasEssays,
    tier,
  });

  const steps = kinds.map((kind) => toStep({ candidates, doneAt: history.doneAt, items, kind }));
  const done = steps.filter((step) => step.status === "done").length;

  if (done < steps.length) {
    return { done, steps, total: steps.length };
  }

  // Finished: the list stays, all checked, through the day its last step was done, then retires.
  const completedOn = getCompletedOn({ doneAt: history.doneAt, kinds, timeZone });
  const today = toIsoDate(getDateInTimeZone({ date: now, timeZone }));

  return completedOn === today ? { completedOn, done, steps, total: steps.length } : null;
}
