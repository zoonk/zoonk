import { type StateTone } from "@/components/state-mark";
import { PROMPT_OUTCOMES, type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { toWords } from "@/lib/format";
import { getLearnerLabel } from "@/lib/learner-label";
import { readEnumQueryParam } from "@/lib/query-param";
import { type GoalUnderstandingView } from "@zoonk/core/view-models/onboarding/contract";
import { goalUnderstandingViewSchema } from "@zoonk/core/view-models/onboarding/view-schemas";
import { type GoalKind } from "@zoonk/db/enums";

export function parsePromptOutcome(params: Partial<Record<string, string | string[]>>) {
  return readEnumQueryParam({ allowed: PROMPT_OUTCOMES, value: params.outcome });
}

export const promptOutcomeLabels: Record<PromptOutcome, string> = {
  failed: "Failed",
  goalCreated: "Goal created",
  inProgress: "In progress",
  noGoal: "Not confirmed",
  unclear: "Too vague",
  unsafe: "Declined",
};

/** A request still being read is going on; one nobody confirmed waits; one Zoonk couldn't use is over. */
export const promptOutcomeTones: Record<PromptOutcome, StateTone> = {
  failed: "failed",
  goalCreated: "done",
  inProgress: "going",
  noGoal: "waiting",
  unclear: "off",
  unsafe: "off",
};

export function parsePromptReading(understanding: unknown): GoalUnderstandingView | null {
  return goalUnderstandingViewSchema.safeParse(understanding).data ?? null;
}

type ReadingSummary = {
  /** The first goal's kind, when the words were read as goals. */
  kind: GoalKind | null;
  label: string;
  text: string;
};

export function getReadingSummary(reading: GoalUnderstandingView | null): ReadingSummary | null {
  if (reading?.status === "goals") {
    return {
      kind: reading.goals[0]?.draft.kind ?? null,
      label: reading.goals.map((goal) => toWords(goal.draft.kind)).join(" · "),
      text: reading.goals.map((goal) => goal.draft.title).join(" · "),
    };
  }

  if (reading?.status === "explain") {
    return { kind: "explain", label: "A question", text: reading.question };
  }

  if (reading?.status === "instrument") {
    return { kind: null, label: "An instrument", text: reading.instrument };
  }

  return null;
}

type PromptLearner = { email: string; isAnonymous: boolean; name: string; username: string | null };

export function getPromptLearnerLabel(user: PromptLearner): string {
  return user.isAnonymous ? "Guest" : getLearnerLabel(user);
}

/** A guest's email is a placeholder Better Auth made up, so it's never shown. */
export function getPromptLearnerEmail(user: PromptLearner): string | null {
  return user.isAnonymous || getLearnerLabel(user) === user.email ? null : user.email;
}
