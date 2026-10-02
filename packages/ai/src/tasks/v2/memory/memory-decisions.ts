import { type MemoryFactText } from "./memory-facts";

/**
 * Starting cutoffs from the memory-gate eval. Keeping a sensitive fact by mistake is worse than
 * losing one, so a modest sensitivity signal is enough to drop a fact, and only a clear request
 * keeps one.
 */
const LASTING_AT = 0.5;
const SENSITIVE_AT = 0.35;
const EXPLICITLY_ASKED_AT = 0.7;

/**
 * Replacing or removing a fact changes what memory holds without the learner watching, so a
 * destructive pick needs a clear majority when the model reports a distribution.
 */
const DESTRUCTIVE_AT = 0.5;

export type MemoryGateCandidate = MemoryFactText & { evidence: string };

export type MemoryGateProbabilities = {
  explicitlyAsked: number;
  lasting: number;
  sensitive: number;
};

export type MemoryGateVerdict = {
  decision: "keep" | "notLasting" | "sensitive";
  /** Whether a kept fact is sensitive, so it can be stored with that flag. */
  sensitive: boolean;
};

/**
 * Turns the gate's three probabilities into one verdict. `allowSensitive` is false for minors and
 * learners of unknown age, whose memory never holds sensitive facts, even when they ask.
 */
export function decideMemoryGate({
  allowSensitive,
  probabilities,
}: {
  allowSensitive: boolean;
  probabilities: MemoryGateProbabilities;
}): MemoryGateVerdict {
  const sensitive = probabilities.sensitive >= SENSITIVE_AT;

  if (probabilities.lasting < LASTING_AT) {
    return { decision: "notLasting", sensitive };
  }

  if (sensitive && !(allowSensitive && probabilities.explicitlyAsked >= EXPLICITLY_ASKED_AT)) {
    return { decision: "sensitive", sensitive };
  }

  return { decision: "keep", sensitive };
}

export type MemoryReconcileAction =
  | { action: "add" }
  | { action: "ignore" }
  | { action: "remove"; index: number }
  | { action: "replace"; index: number };

export type MemoryFactIntent = "forget" | "remember";

const LABEL_PATTERN = /^(?<action>replace|remove)_(?<position>\d+)$/u;

/**
 * The choice labels for one new fact against `existingCount` related facts. Labels only name
 * positions; the facts themselves stay in the untrusted state, so learner text never becomes part
 * of the trusted question.
 */
export function getMemoryReconcileLabels(existingCount: number): Record<string, string> {
  const positions = Array.from({ length: existingCount }, (_, index) => index + 1);

  const labels: [string, string][] = [
    [
      "add",
      "The new fact is new information: it doesn't repeat, update or contradict any existing fact.",
    ],
    [
      "ignore",
      "An existing fact already says the same thing or more, or a fact to forget matches none.",
    ],
    ...positions.map((position): [string, string] => [
      `replace_${position}`,
      `The new fact changes, corrects or adds detail to existing fact ${position} and takes its place.`,
    ]),
    ...positions.map((position): [string, string] => [
      `remove_${position}`,
      `Existing fact ${position} stopped being true or should be forgotten, and the new fact adds nothing to keep.`,
    ]),
  ];

  return Object.fromEntries(labels);
}

/** Reads a label back into an action; positions are 1-based in labels and 0-based in actions. */
function parseMemoryReconcileLabel({
  existingCount,
  label,
}: {
  existingCount: number;
  label: string;
}): MemoryReconcileAction | null {
  if (label === "add" || label === "ignore") {
    return { action: label };
  }

  const groups = LABEL_PATTERN.exec(label)?.groups;
  const position = Number(groups?.position);

  if (!groups || position < 1 || position > existingCount) {
    return null;
  }

  return { action: groups.action === "remove" ? "remove" : "replace", index: position - 1 };
}

/**
 * What to do when the model's pick can't be used: keep a fact to remember (a duplicate is safer
 * than a lost fact) and do nothing for a fact to forget.
 */
function getSafeAction(intent: MemoryFactIntent): MemoryReconcileAction {
  return intent === "forget" ? { action: "ignore" } : { action: "add" };
}

function isConfident({
  label,
  probabilities,
}: {
  label: string;
  probabilities?: Readonly<Record<string, number>>;
}): boolean {
  const probability = probabilities?.[label];
  return probability === undefined || probability >= DESTRUCTIVE_AT;
}

/**
 * A fact to forget is never stored: pointing it at an existing fact means removing that fact, and
 * adding it means nothing matched.
 */
function applyIntent({
  action,
  intent,
}: {
  action: MemoryReconcileAction;
  intent: MemoryFactIntent;
}): MemoryReconcileAction {
  if (intent === "remember") {
    return action;
  }

  if (action.action === "replace") {
    return { action: "remove", index: action.index };
  }

  return action.action === "add" ? { action: "ignore" } : action;
}

/**
 * Turns the model's choice into an action. A replace or remove needs a clear majority when the
 * model reports a distribution, and an unknown label falls back to the safe action.
 */
export function decideMemoryReconcile({
  choice,
  existingCount,
  intent,
  probabilities,
}: {
  choice: string;
  existingCount: number;
  intent: MemoryFactIntent;
  probabilities?: Readonly<Record<string, number>>;
}): MemoryReconcileAction {
  const action = parseMemoryReconcileLabel({ existingCount, label: choice });

  if (!action) {
    return getSafeAction(intent);
  }

  if (
    (action.action === "replace" || action.action === "remove") &&
    !isConfident({ label: choice, probabilities })
  ) {
    return getSafeAction(intent);
  }

  return applyIntent({ action, intent });
}
