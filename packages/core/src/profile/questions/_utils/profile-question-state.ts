import {
  type MemoryFact,
  type ProfileQuestion,
  type TransactionClient,
  type UserLearningProfile,
  prisma,
} from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { normalizeProfileAnswer } from "../profile-answer-normalization";
import { normalizeProfileFavorites } from "../profile-favorites";
import { PROFILE_OPTION_IDS } from "../profile-option-ids";
import { PROFILE_CONTENT } from "../profile-options";
import {
  PROFILE_QUESTIONS,
  PROFILE_QUESTION_VERSIONS,
  type ProfileAnswerInput,
  type ProfileQuestionView,
  getProfileSteps,
  profileAnswerInputSchema,
} from "../profile-question-contract";

type Client = Pick<
  TransactionClient,
  "profileAnswer" | "memoryFact" | "learnerCondition" | "userLearningProfile"
>;

export async function loadProfileQuestionState({
  userId,
  client = prisma,
  profile,
}: {
  userId: string;
  client?: Client;
  profile?: Promise<UserLearningProfile | null>;
}) {
  const [answers, facts, conditions, learningProfile] = await Promise.all([
    client.profileAnswer.findMany({ where: { userId } }),
    client.memoryFact.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { sourceRef: { equals: "profile", path: ["kind"] }, status: "active", userId },
    }),
    client.learnerCondition.findMany({ orderBy: { condition: "asc" }, where: { userId } }),
    profile ?? client.userLearningProfile.findUnique({ where: { userId } }),
  ]);

  return { answers, conditions, facts, profile: learningProfile };
}
export type ProfileQuestionState = Awaited<ReturnType<typeof loadProfileQuestionState>>;

export function getQuestionFacts({
  facts,
  question,
}: {
  facts: MemoryFact[];
  question: ProfileQuestion;
}): MemoryFact[] {
  return facts.filter((fact) => isJsonObject(fact.sourceRef) && fact.sourceRef.id === question);
}

function readFactAnswer(fact: MemoryFact): Record<string, unknown> {
  return isJsonObject(fact.profileAnswer) ? fact.profileAnswer : {};
}

export function savedProfileAnswer({
  state,
  question,
}: {
  state: ProfileQuestionState;
  question: ProfileQuestion;
}): ProfileAnswerInput {
  const facts = getQuestionFacts({ facts: state.facts, question });
  const first = facts[0] ? readFactAnswer(facts[0]) : {};

  const declined =
    state.answers.find((answer) => answer.question === question)?.outcome === "declined";

  const parsed = profileAnswerInputSchema.parse({
    answer: questionAnswer({ declined, facts, first, question, state }),
    question,
  });

  return normalizeProfileAnswer(parsed);
}

function questionAnswer({
  state,
  question,
  facts,
  first,
  declined,
}: {
  state: ProfileQuestionState;
  question: ProfileQuestion;
  facts: MemoryFact[];
  first: Record<string, unknown>;
  declined: boolean;
}): Record<string, unknown> {
  switch (question) {
    case "conditions":
      return {
        conditions: state.conditions.map(({ condition, note }) => ({ condition, note })),
        consented: true,
        declined,
      };
    case "learningSupport":
      return {
        declined,
        needs: state.profile?.learningNeeds ?? [],
        note: typeof first.note === "string" ? first.note : null,
        soundEffects: state.profile?.soundsEnabled ?? true,
      };
    case "studies":
      return {
        declined,
        studies: facts.flatMap((fact) => {
          const answer = readFactAnswer(fact);

          return typeof answer.field === "string"
            ? [{ field: answer.field, subject: answer.subject ?? null }]
            : [];
        }),
      };
    case "work":
      return { declined, job: first.job ?? null, status: first.status ?? null };
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return {
        declined,
        favorites: Array.isArray(first.favorites)
          ? normalizeProfileFavorites(first.favorites.join(","))
          : "",
        picks: first.picks ?? [],
      };
    default:
      return { declined };
  }
}

const LOCALE_EXTRA_IDS = new Set(
  Object.values(PROFILE_CONTENT).flatMap((content) => Object.values(content.extras).flat()),
);

export function toProfileQuestionView({
  state,
  question,
  locale,
}: {
  state: ProfileQuestionState;
  question: ProfileQuestion;
  locale: SupportedLocale;
}): ProfileQuestionView {
  const input = savedProfileAnswer({ question, state });
  const content = PROFILE_CONTENT[locale];

  const ids = [
    ...(content.extras[question] ?? []),
    ...PROFILE_OPTION_IDS[question].filter((id) => !LOCALE_EXTRA_IDS.has(id)),
  ];

  return {
    id: question,
    options: ids.flatMap((id) => {
      const option = content.options[question][id];
      return option ? [{ description: option.description, id, label: option.label }] : [];
    }),
    saved: toSavedView(input),
    status: state.answers.find((answer) => answer.question === question)?.outcome ?? null,
    version: PROFILE_QUESTION_VERSIONS[question],
  };
}

function toSavedView(input: ProfileAnswerInput): ProfileQuestionView["saved"] {
  switch (input.question) {
    case "work":
      return {
        picks: input.answer.status ? [input.answer.status] : [],
        studies: [],
        text: input.answer.job ?? "",
      };
    case "studies":
      return { picks: [], studies: input.answer.studies, text: "" };
    case "conditions":
      return {
        picks: input.answer.conditions.map((item) => item.condition),
        studies: [],
        text: input.answer.conditions.find((item) => item.condition === "other")?.note ?? "",
      };
    case "learningSupport":
      return {
        picks: [
          ...input.answer.needs,
          ...(input.answer.soundEffects === false ? ["noSoundEffects"] : []),
        ],
        studies: [],
        text: input.answer.note ?? "",
      };
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return { picks: input.answer.picks, studies: [], text: input.answer.favorites };
    default:
      return { picks: [], studies: [], text: "" };
  }
}

export function toProfileQuestionsView({
  state,
  locale,
}: {
  state: ProfileQuestionState;
  locale: SupportedLocale;
}) {
  return {
    memoryEnabled: state.profile?.memoryEnabled ?? true,
    questions: PROFILE_QUESTIONS.map((question) =>
      toProfileQuestionView({ locale, question, state }),
    ),
  };
}

export function getStateProfileSteps({
  goal,
  state,
}: {
  goal: Parameters<typeof getProfileSteps>[0]["goal"];
  state: ProfileQuestionState;
}) {
  return getProfileSteps({
    answered: Object.fromEntries(state.answers.map((answer) => [answer.question, answer.version])),
    goal,
    memoryEnabled: state.profile?.memoryEnabled ?? true,
  });
}
