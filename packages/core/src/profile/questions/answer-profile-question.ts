import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getAllowanceCacheTag,
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getMemoryCacheTag,
} from "../../cache/tags";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { toProfileQuestionSavedEvent } from "./_utils/profile-question-event";
import {
  getQuestionFacts,
  loadProfileQuestionState,
  savedProfileAnswer,
  toProfileQuestionView,
} from "./_utils/profile-question-state";
import { replaceProfileFacts } from "./_utils/save-profile-facts";
import { parseProfileAnswer } from "./profile-answer-normalization";
import {
  PROFILE_QUESTION_VERSIONS,
  type ProfileAnswerInput,
  type ProfileQuestionView,
  isBiographyQuestion,
} from "./profile-question-contract";

export type ProfileAnswerResult =
  | { status: "saved"; changed: boolean; question: ProfileQuestionView }
  | { status: "unauthorized" | "invalid" | "memoryOff" | "consentRequired" };

function comparable(input: ProfileAnswerInput, soundsEnabled: boolean, memoryEnabled: boolean) {
  if (input.question === "conditions") {
    return { ...input.answer, consented: undefined };
  }

  if (input.question === "learningSupport") {
    return {
      ...input.answer,
      soundEffects: input.answer.soundEffects ?? soundsEnabled,
      ...(memoryEnabled ? {} : { note: null }),
    };
  }

  return input.answer;
}

async function saveSettings({
  tx,
  userId,
  input,
}: {
  tx: TransactionClient;
  userId: string;
  input: ProfileAnswerInput;
}) {
  if (input.question === "conditions") {
    await tx.learnerCondition.deleteMany({ where: { userId } });

    if (!input.answer.declined && input.answer.conditions.length > 0) {
      await tx.learnerCondition.createMany({
        data: input.answer.conditions.map((condition) => ({ ...condition, userId })),
      });
    }
  }

  if (input.question === "learningSupport") {
    const data = {
      learningNeeds: input.answer.declined ? [] : input.answer.needs,
      soundsEnabled: input.answer.soundEffects,
    };

    await tx.userLearningProfile.upsert({
      create: { userId, ...data },
      update: data,
      where: { userId },
    });
  }

  if (input.question === "addressForm") {
    const data = { addressForm: input.answer.declined ? null : input.answer.form };

    await tx.userLearningProfile.upsert({
      create: { userId, ...data },
      update: data,
      where: { userId },
    });
  }
}

export async function answerProfileQuestion({
  input: unparsed,
  locale,
  onboardingGoalId,
}: {
  input: ProfileAnswerInput;
  locale: SupportedLocale;
  onboardingGoalId?: string;
}): Promise<ProfileAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const submitted = parseProfileAnswer(unparsed);

  if (!submitted) {
    return { status: "invalid" };
  }

  if (
    submitted.question === "conditions" &&
    !submitted.answer.declined &&
    !submitted.answer.consented
  ) {
    return { status: "consentRequired" };
  }

  const userId = session.user.id;
  const viewer = await getEntitlementViewer();

  const saved = await writeLearnerChange<
    | { status: "memoryOff" | "invalid" }
    | { status: "saved"; changed: boolean; checked: boolean; question: ProfileQuestionView }
  >({ userId }, async (tx) => {
    const state = await loadProfileQuestionState({ client: tx, userId });
    const memoryEnabled = state.profile?.memoryEnabled ?? true;

    const input =
      !memoryEnabled && submitted.question === "learningSupport"
        ? parseProfileAnswer({ ...submitted, answer: { ...submitted.answer, note: null } })
        : submitted;

    if (!input) {
      return unchanged({ status: "invalid" as const });
    }

    if (!memoryEnabled && isBiographyQuestion(input.question)) {
      return unchanged({ status: "memoryOff" as const });
    }

    const row = state.answers.find((answer) => answer.question === input.question);
    const existing = savedProfileAnswer({ question: input.question, state });
    const sounds = state.profile?.soundsEnabled ?? true;

    if (
      row?.version === PROFILE_QUESTION_VERSIONS[input.question] &&
      isDeepStrictEqual(
        comparable(existing, sounds, memoryEnabled),
        comparable(input, sounds, memoryEnabled),
      )
    ) {
      return unchanged({
        changed: false,
        checked: false,
        question: toProfileQuestionView({ locale, question: input.question, state }),
        status: "saved" as const,
      });
    }

    const checked =
      isBiographyQuestion(input.question) || (input.question === "learningSupport" && memoryEnabled)
        ? await replaceProfileFacts({
            existing: getQuestionFacts({ facts: state.facts, question: input.question }),
            input,
            locale,
            tx,
            userId,
            viewer,
          })
        : false;

    await saveSettings({ input, tx, userId });

    const data = {
      answeredAt: new Date(),
      outcome: input.answer.declined ? ("declined" as const) : ("answered" as const),
      version: PROFILE_QUESTION_VERSIONS[input.question],
    };

    await tx.profileAnswer.upsert({
      create: { question: input.question, userId, ...data },
      update: data,
      where: { userId_question: { question: input.question, userId } },
    });

    const current = await loadProfileQuestionState({ client: tx, userId });

    return {
      changed: true,
      checked,
      question: toProfileQuestionView({ locale, question: input.question, state: current }),
      status: "saved" as const,
    };
  });

  if (saved.status !== "saved") {
    return saved;
  }

  if (saved.changed) {
    after(() =>
      trackLearnerEvents({
        events: [
          toProfileQuestionSavedEvent({
            from: onboardingGoalId ? "onboarding" : "settings",
            input: submitted,
          }),
        ],
        goalId: onboardingGoalId,
        locale,
        userId,
      }),
    );

    revalidateCacheTags([
      getMemoryCacheTag(userId),
      getLearningProfileCacheTag(userId),
      getGoalsCacheTag(userId),
      getLearnerModelCacheTag(userId),
      ...(saved.checked ? [getAllowanceCacheTag(userId)] : []),
    ]);
  }

  return { changed: saved.changed, question: saved.question, status: "saved" };
}
