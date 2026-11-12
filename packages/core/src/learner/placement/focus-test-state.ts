import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { getAnsweredQuestions } from "../../view-models/onboarding/onboarding-steps";
import { isPlacementSkipped } from "./placement-contract";

/** The key of `goal.details` only core writes, where an exam goal's Focus test keeps its state. */
export const FOCUS_TEST_DETAIL = "focusTest";

const sittingSchema = z.object({
  answered: z.int().min(0),
  id: z.string(),
  kind: z.enum(["continuation", "first"]),
  questions: z.int().min(1),
});

const suggestedSubjectSchema = z.object({
  areas: z.array(z.string()),
  name: z.string(),
  shortName: z.string().nullable(),
});

const summarySchema = z.object({
  asked: z.int().min(0),
  complete: z.boolean(),
  /** `summaryInputsKey` of what it was counted from; another key means it's out of date. */
  inputsKey: z.string().nullable().default(null),
  /** The questions a start would open with no sitting open; null when nothing can be asked. */
  offerQuestions: z.int().min(1).nullable(),
  paceMs: z.number().positive(),
  quick: z.int().min(0),
  /** The subjects a short plan should focus, the most needed first; empty without a date. */
  suggested: z.array(suggestedSubjectSchema),
  total: z.int().min(0),
  /** Subjects quick questions can check that have no test answer yet. */
  unasked: z.int().min(0),
});

const recordSchema = z.object({
  dismissedAt: z.iso.datetime().nullable().default(null),
  /**
   * The test's current focus, set with the daily time or an applied proposal. Cleared when the
   * plan stops following it; Undo restores its prior ownership.
   */
  focus: z.array(z.string()).nullable().default(null),
  pausedAt: z.iso.datetime().nullable().default(null),
  sitting: sittingSchema.nullable().default(null),
  skippedOn: z.iso.date().nullable().default(null),
  startedAt: z.iso.datetime().nullable().default(null),
  /** What the plan's row, Today and the time question show, kept so they never load the answers. */
  summary: summarySchema.nullable().default(null),
});

export type FocusTestRecord = z.infer<typeof recordSchema>;

export type FocusTestSummaryRecord = z.infer<typeof summarySchema>;

export const NEW_FOCUS_TEST_RECORD: FocusTestRecord = recordSchema.parse({});

type GoalDetails = { details: unknown };

/** Null for a goal the Focus test never touched, such as one placed before it existed. */
export function readFocusTestRecord(goal: GoalDetails): FocusTestRecord | null {
  const stored = isJsonObject(goal.details) ? goal.details[FOCUS_TEST_DETAIL] : undefined;
  const parsed = recordSchema.safeParse(stored);

  return parsed.success ? parsed.data : null;
}

/**
 * A goal placed before the Focus test kept its own state counts as started when it passed
 * placement without declining it, so its sessions go on asking.
 */
export function isFocusTestStarted(goal: GoalDetails): boolean {
  const record = readFocusTestRecord(goal);

  if (record) {
    return record.startedAt !== null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  return getAnsweredQuestions(details).includes("placement") && !isPlacementSkipped(goal);
}

/** Questions are written for a learner who skipped placement once they start the test. */
export function wantsPlacementQuestions(goal: GoalDetails): boolean {
  return !isPlacementSkipped(goal) || isFocusTestStarted(goal);
}
