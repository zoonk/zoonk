import { randomUUID } from "node:crypto";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A learn goal understood from the typed words, the card's simplest case. */
function learnUnderstanding(prompt: string): object {
  return {
    goals: [
      {
        draft: {
          details: { subject: "Quantum physics" },
          kind: "learn",
          language: "en",
          prompt,
          title: "Understand quantum physics",
        },
        examDates: [],
      },
    ],
    schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
    status: "goals",
  };
}

function withGoalOnboardingId({ goal, id }: { goal: unknown; id: string }): unknown {
  if (!isRecord(goal) || !isRecord(goal.draft)) {
    return goal;
  }

  const details = isRecord(goal.draft.details) ? goal.draft.details : {};
  return { ...goal, draft: { ...goal.draft, details: { ...details, onboardingId: id } } };
}

/** Goals confirmed from a draft carry its id, which is how the draft finds them. */
function withOnboardingId({ id, understanding }: { id: string; understanding: object }): object {
  if (!isRecord(understanding) || !Array.isArray(understanding.goals)) {
    return understanding;
  }

  return {
    ...understanding,
    goals: understanding.goals.map((goal: unknown) => withGoalOnboardingId({ goal, id })),
  };
}

/**
 * A goal a learner typed in onboarding: understood (a learn goal's card unless `understanding`,
 * a `GoalUnderstandingView`, says otherwise; its goals get the draft's id as `onboardingId`),
 * still being read (`status: "understanding"`, with `runId` for a run to follow), or failed.
 */
export async function onboardingDraftFixture({
  understanding,
  ...attrs
}: FixtureAttrs<OnboardingDraft, "understanding"> & Pick<OnboardingDraft, "userId">) {
  const id = attrs.id ?? randomUUID();
  const prompt = attrs.prompt ?? "Understand quantum physics";
  const status = attrs.status ?? "understood";
  const card = understanding ?? learnUnderstanding(prompt);

  return prisma.onboardingDraft.create({
    data: {
      language: "en",
      timeZone: "UTC",
      ...attrs,
      id,
      prompt,
      status,
      understanding:
        status === "understood" ? withOnboardingId({ id, understanding: card }) : undefined,
    },
  });
}
