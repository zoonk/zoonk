import { type SupportedLocale } from "@zoonk/utils/locale";
import { normalizeProfileFavorites, splitProfileFavorites } from "./profile-favorites";
import { GENERAL_TOOL_IDS } from "./profile-option-ids";
import { PROFILE_CONTENT } from "./profile-options";
import {
  MAX_PROFILE_TOOL_PICKS,
  type ProfileAnswerInput,
  type ProfileQuestionView,
  profileAnswerInputSchema,
} from "./profile-question-contract";

type ToolAnswer = Extract<ProfileAnswerInput, { question: "tools" }>;

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)].toSorted();
}

function normalizePicks<T extends { answer: { favorites: string; picks: string[] } }>(input: T): T {
  return {
    ...input,
    answer: {
      ...input.answer,
      favorites: normalizeProfileFavorites(input.answer.favorites),
      picks: uniqueIds(input.answer.picks),
    },
  };
}

export function normalizeProfileAnswer(input: ProfileAnswerInput): ProfileAnswerInput {
  switch (input.question) {
    case "work":
      return { ...input, answer: { ...input.answer, job: input.answer.job?.trim() || null } };
    case "studies":
      return {
        ...input,
        answer: {
          ...input.answer,
          studies: [
            ...new Map(
              input.answer.studies.map((study) => [
                study.field,
                { ...study, subject: study.subject?.trim() || null },
              ]),
            ).values(),
          ].toSorted((a, b) => a.field.localeCompare(b.field)),
        },
      };
    case "conditions":
      return {
        ...input,
        answer: {
          ...input.answer,
          conditions: [
            ...new Map(
              input.answer.conditions.map((condition) => [
                condition.condition,
                {
                  ...condition,
                  note: condition.condition === "other" ? condition.note?.trim() || null : null,
                },
              ]),
            ).values(),
          ].toSorted((a, b) => a.condition.localeCompare(b.condition)),
        },
      };
    case "learningSupport":
      return {
        ...input,
        answer: {
          ...input.answer,
          needs: uniqueIds(input.answer.needs),
          note: input.answer.note?.trim() || null,
        },
      };
    case "addressForm":
      return input;
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return normalizePicks(input);
    default:
      return input satisfies never;
  }
}

export function reconcileToolAnswer({
  input,
  locale,
  options,
}: {
  input: ToolAnswer;
  locale: SupportedLocale;
  options: ProfileQuestionView["options"];
}): ToolAnswer {
  const offered = new Map<string, string>();

  for (const { id, label } of options) {
    const key = label.toLowerCase();

    if (!offered.has(key) || GENERAL_TOOL_IDS.has(id)) {
      offered.set(key, id);
    }
  }

  const picked = new Map<string, string>();
  const general = PROFILE_CONTENT[locale].options.tools;

  for (const id of input.answer.picks) {
    const generalId = GENERAL_TOOL_IDS.has(id);
    const name = (generalId ? (general[id]?.label ?? id) : id).toLowerCase();

    if (!picked.has(name) || generalId) {
      picked.set(name, generalId ? id : (offered.get(name) ?? id));
    }
  }

  const favorites = splitProfileFavorites(input.answer.favorites).filter((name) => {
    const key = name.toLowerCase();

    if (picked.has(key)) {
      return false;
    }

    const id = offered.get(key);

    if (id === undefined || picked.size >= MAX_PROFILE_TOOL_PICKS) {
      return true;
    }

    picked.set(key, id);
    return false;
  });

  return {
    ...input,
    answer: {
      ...input.answer,
      favorites: favorites.join(", "),
      picks: [...picked.values()].toSorted(),
    },
  };
}

function hasProfileAnswerContent(input: ProfileAnswerInput): boolean {
  switch (input.question) {
    case "work":
      return input.answer.status !== null || input.answer.job !== null;
    case "studies":
      return input.answer.studies.length > 0;
    case "conditions":
      return input.answer.conditions.length > 0;
    case "learningSupport":
      return (
        input.answer.needs.length > 0 ||
        input.answer.note !== null ||
        (!input.answer.declined && input.answer.soundEffects === false)
      );
    case "addressForm":
      return input.answer.form !== null;
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return input.answer.picks.length > 0 || Boolean(input.answer.favorites);
    default:
      return false;
  }
}

export function parseProfileAnswer(input: unknown): ProfileAnswerInput | null {
  const parsed = profileAnswerInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const normalized = normalizeProfileAnswer(parsed.data);

  if (normalized.answer.declined === hasProfileAnswerContent(normalized)) {
    return null;
  }

  return validContent(normalized);
}

function validContent(normalized: ProfileAnswerInput): ProfileAnswerInput | null {
  switch (normalized.question) {
    case "work":
      return normalized.answer.job &&
        normalized.answer.status !== "work" &&
        normalized.answer.status !== "workAndStudy"
        ? null
        : normalized;
    case "studies":
      return normalized.answer.studies.some((study) => study.field === "other" && !study.subject)
        ? null
        : normalized;
    case "conditions":
      return normalized.answer.conditions.some(
        (condition) => condition.condition === "other" && !condition.note,
      )
        ? null
        : normalized;
    case "learningSupport":
    case "addressForm":
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return normalized;
    default:
      return null;
  }
}
