import { type ProfileAnswerInput, profileAnswerInputSchema } from "./profile-question-contract";

export function splitProfileFavorites(text: string): string[] {
  const seen = new Set<string>();

  return text.split(/[,;、，\r\n]/u).flatMap((item) => {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [trimmed];
  });
}

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)].toSorted();
}

function normalizePicks<T extends { answer: { favorites: string; picks: string[] } }>(input: T): T {
  return {
    ...input,
    answer: {
      ...input.answer,
      favorites: splitProfileFavorites(input.answer.favorites).join(", "),
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

  if (!profileAnswerInputSchema.safeParse(normalized).success) {
    return null;
  }

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
      return normalized.answer.studies.length > 3 ||
        normalized.answer.studies.some((study) => study.field === "other" && !study.subject)
        ? null
        : normalized;
    case "conditions":
      return normalized.answer.conditions.some(
        (condition) => condition.condition === "other" && !condition.note,
      )
        ? null
        : normalized;
    case "learningSupport":
      return normalized;
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return normalized.answer.picks.length > 3 ? null : normalized;
    default:
      return null;
  }
}
