import { PROMPT_OUTCOMES, type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { getLearnerLabel } from "@/lib/learner-label";
import { readEnumQueryParam } from "@/lib/query-param";
import { type GoalUnderstandingView } from "@zoonk/core/view-models/onboarding/contract";
import { goalUnderstandingViewSchema } from "@zoonk/core/view-models/onboarding/view-schemas";

export function parsePromptOutcome(params: Partial<Record<string, string | string[]>>) {
  return readEnumQueryParam({ allowed: PROMPT_OUTCOMES, value: params.outcome });
}

export const promptOutcomeLabels: Record<PromptOutcome, string> = {
  failed: "Failed",
  goalCreated: "Goal created",
  inProgress: "In progress",
  noGoal: "No goal",
  unclear: "Too vague",
  unsafe: "Declined",
};

export function getPromptOutcomeVariant(outcome: PromptOutcome) {
  if (outcome === "goalCreated") {
    return "success" as const;
  }

  return outcome === "failed" ? ("destructive" as const) : ("secondary" as const);
}

export function parsePromptReading(understanding: unknown): GoalUnderstandingView | null {
  return goalUnderstandingViewSchema.safeParse(understanding).data ?? null;
}

export function getReadingSummary(
  reading: GoalUnderstandingView | null,
): { label: string; text: string } | null {
  if (reading?.status === "goals") {
    return {
      label: reading.goals.map((goal) => goal.draft.kind).join(" · "),
      text: reading.goals.map((goal) => goal.draft.title).join(" · "),
    };
  }

  if (reading?.status === "explain") {
    return { label: "Question", text: reading.question };
  }

  if (reading?.status === "instrument") {
    return { label: "Instrument", text: reading.instrument };
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
