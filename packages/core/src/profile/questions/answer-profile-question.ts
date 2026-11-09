import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getAllowanceCacheTag,
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getMemoryCacheTag,
} from "../../cache/tags";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../../entitlements/claim-usage";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { forgetExampleLines } from "../../memory/_utils/forget-example-lines";
import { LEARNER_CONFIDENCE } from "../../memory/_utils/memory-candidates";
import { getSession } from "../../users/get-session";
import {
  loadProfileQuestionState,
  savedProfileAnswer,
  toProfileQuestionView,
} from "./_utils/profile-question-state";
import { parseProfileAnswer } from "./profile-answer-normalization";
import {
  PROFILE_QUESTION_VERSIONS,
  type ProfileAnswerInput,
  type ProfileQuestionView,
  isBiographyQuestion,
} from "./profile-question-contract";
import { toProfileFacts } from "./profile-statements";

export type ProfileAnswerResult =
  | { status: "saved"; question: ProfileQuestionView }
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

async function replaceFacts({
  tx,
  userId,
  input,
  locale,
  viewer,
}: {
  tx: TransactionClient;
  userId: string;
  input: ProfileAnswerInput;
  locale: SupportedLocale;
  viewer: EntitlementViewer | null;
}): Promise<boolean> {
  await tx.memoryFact.updateMany({
    data: { deletedAt: new Date(), status: "deleted" },
    where: {
      AND: [
        { sourceRef: { equals: "profile", path: ["kind"] } },
        { sourceRef: { equals: input.question, path: ["id"] } },
      ],
      status: "active",
      userId,
    },
  });

  const created = await tx.memoryFact.createManyAndReturn({
    data: toProfileFacts({ ...input, locale }).map((fact) => ({
      ...fact,
      confidence: LEARNER_CONFIDENCE,
      origin: "said",
      sourceRef: { id: input.question, kind: "profile" },
      userId,
    })),
  });

  const checked: typeof created = [];

  for (const fact of created.filter((item) => item.sensitive)) {
    // oxlint-disable-next-line no-await-in-loop -- Each claim must see the preceding claim in this transaction.
    if (viewer && (await claimAssistInWrite({ transaction: tx, viewer }))) {
      checked.push(fact);
    }
  }

  if (checked.length > 0) {
    await oweFollowUps({
      db: tx,
      followUps: checked.map((fact) => ({
        input: { factId: fact.id, statement: fact.statement },
        kind: "checkFactSensitivity",
      })),
      userId,
    });
  }

  await forgetExampleLines({ client: tx, userId });
  return checked.length > 0;
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
}

export async function answerProfileQuestion({
  input: unparsed,
  locale,
}: {
  input: ProfileAnswerInput;
  locale: SupportedLocale;
}): Promise<ProfileAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const input = parseProfileAnswer(unparsed);

  if (!input) {
    return { status: "invalid" };
  }

  if (input.question === "conditions" && !input.answer.declined && !input.answer.consented) {
    return { status: "consentRequired" };
  }

  const userId = session.user.id;
  const viewer = await getEntitlementViewer();

  const saved = await writeLearnerChange<
    | { status: "memoryOff" }
    | { status: "saved"; changed: boolean; checked: boolean; question: ProfileQuestionView }
  >({ userId }, async (tx) => {
    const state = await loadProfileQuestionState({ client: tx, userId });
    const memoryEnabled = state.profile?.memoryEnabled ?? true;

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
        ? await replaceFacts({ input, locale, tx, userId, viewer })
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

  if (saved.status === "memoryOff") {
    return saved;
  }

  if (saved.changed) {
    revalidateCacheTags([
      getMemoryCacheTag(userId),
      getLearningProfileCacheTag(userId),
      getGoalsCacheTag(userId),
      getLearnerModelCacheTag(userId),
      ...(saved.checked ? [getAllowanceCacheTag(userId)] : []),
    ]);
  }

  return { question: saved.question, status: "saved" };
}
