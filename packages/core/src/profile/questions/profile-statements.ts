import { type MemoryCategory } from "@zoonk/db/enums";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { splitProfileFavorites } from "./profile-favorites";
import { PROFILE_CONTENT } from "./profile-options";
import { type ProfileAnswerInput } from "./profile-question-contract";

type ProfileFact = {
  statement: string;
  category: MemoryCategory;
  sensitive: boolean;
  profileAnswer: Record<string, string | string[] | null>;
};

export function toProfileFacts(
  input: ProfileAnswerInput & { locale: SupportedLocale },
): ProfileFact[] {
  const { question, answer, locale } = input;

  if (answer.declined || question === "conditions") {
    return [];
  }

  const content = PROFILE_CONTENT[locale];
  const templates = content.templates[question] ?? {};

  const list = (items: string[]) =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(items);

  const fragment = (id: string) => content.options[question][id]?.fragment ?? id;

  const render = (key: string, values: Record<string, string>) =>
    (templates[key] ?? "").replaceAll(
      /\{(?<name>\w+)\}/gu,
      (_, name: string) => values[name] ?? "",
    );

  switch (input.question) {
    case "learningSupport":
      return input.answer.note
        ? [
            {
              category: "learning",
              profileAnswer: { note: input.answer.note },
              sensitive: true,
              statement: input.answer.note,
            },
          ]
        : [];
    case "studies":
      return input.answer.studies.map((study) => ({
        category: "background",
        profileAnswer: { ...study },
        sensitive: Boolean(study.subject),
        statement: render("subject", { subject: study.subject ?? fragment(study.field) }),
      }));
    case "work": {
      const { status, job } = input.answer;

      if (!status) {
        return [];
      }

      return [
        {
          category: "background",
          profileAnswer: { job, status },
          sensitive: Boolean(job),
          statement: render(job ? `${status}WithJob` : status, { job: job ?? "" }),
        },
      ];
    }
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch": {
      const { picks, favorites: text } = input.answer;
      const favorites = splitProfileFavorites(text);
      const picked = picks.map((id) => fragment(id));
      const combined = list(question === "tools" ? [...picked, ...favorites] : picked);

      const capitalized =
        question === "activities"
          ? combined.charAt(0).toLocaleUpperCase(locale) + combined.slice(1)
          : combined;

      return [
        {
          category: question === "tools" ? "background" : "context",
          profileAnswer: { favorites, picks },
          sensitive: favorites.length > 0,
          statement: render(
            getListTemplate({ hasFavorites: favorites.length > 0, hasPicks: picks.length > 0 }),
            { favorites: list(favorites), picks: capitalized },
          ),
        },
      ];
    }
    default:
      return [];
  }
}

function getListTemplate({
  hasFavorites,
  hasPicks,
}: {
  hasFavorites: boolean;
  hasPicks: boolean;
}): string {
  if (!hasPicks) {
    return "favorites";
  }

  return hasFavorites ? "both" : "picks";
}
