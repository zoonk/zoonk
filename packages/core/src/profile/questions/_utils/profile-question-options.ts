import { type ProfileQuestion } from "@zoonk/db/enums";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { PROFILE_OPTION_IDS } from "../profile-option-ids";
import { PROFILE_CONTENT } from "../profile-options";
import { type ProfileQuestionView } from "../profile-question-contract";

const LOCALE_EXTRA_IDS = new Set(
  Object.values(PROFILE_CONTENT).flatMap((content) => Object.values(content.extras).flat()),
);

export function getProfileQuestionOptions({
  locale,
  picks = [],
  question,
  suggestedTools,
}: {
  locale: SupportedLocale;
  picks?: string[];
  question: ProfileQuestion;
  suggestedTools?: string[];
}): ProfileQuestionView["options"] {
  const content = PROFILE_CONTENT[locale];

  const suggestedIds =
    question === "tools"
      ? (suggestedTools ?? []).map(
          (name) =>
            PROFILE_OPTION_IDS.tools.find(
              (id) => content.options.tools[id]?.label.toLowerCase() === name.toLowerCase(),
            ) ?? name,
        )
      : [];

  const ids = new Set([
    ...(suggestedIds.length > 0
      ? suggestedIds
      : [
          ...(content.extras[question] ?? []),
          ...PROFILE_OPTION_IDS[question].filter((id) => !LOCALE_EXTRA_IDS.has(id)),
        ]),
    ...picks,
  ]);

  return [...ids].flatMap((id) => {
    const definingContent = LOCALE_EXTRA_IDS.has(id)
      ? Object.values(PROFILE_CONTENT).find((item) => item.extras[question]?.includes(id))
      : content;

    const options = definingContent?.options[question];
    const option = options && Object.hasOwn(options, id) ? options[id] : undefined;

    if (option) {
      return [{ description: option.description, id, label: option.label }];
    }

    return question === "tools" ? [{ description: null, id, label: id }] : [];
  });
}
