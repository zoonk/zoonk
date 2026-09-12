"use client";

import { type CoursePlanInput } from "@zoonk/core/courses/learning-plan-contract";
import {
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireTitle,
} from "@zoonk/ui/components/questionnaire";
import {
  BookOpenIcon,
  HeadphonesIcon,
  LanguagesIcon,
  LetterTextIcon,
  MessageSquareIcon,
  SpellCheckIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";

type HiddenKinds = NonNullable<CoursePlanInput["hiddenLessonKinds"]>;
const DAILY_MINUTE_CHOICES = ["5", "10", "20"];

export function CourseDailyPaceQuestion({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Learn for as long as you like."),
      title: t("No daily target"),
      value: "none",
    },
    ...DAILY_MINUTE_CHOICES.map((minutes) => ({
      description: "",
      title: t("{minutes, number} minutes", { minutes: Number(minutes) }),
      value: minutes,
    })),
  ];

  const customValue = !choices.some((choice) => choice.value === value);

  const allChoices = customValue
    ? [
        ...choices,
        {
          description: t("Your current target."),
          title: t("{minutes, number} minutes", { minutes: Number(value) }),
          value,
        },
      ]
    : choices;

  return (
    <QuestionnaireItem name="dailyMinutes" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("How much time would you like to spend each day?")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t(
          "Choose a daily commitment that fits your routine. You can always learn for longer or change it later.",
        )}
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        {allChoices.map((choice) => (
          <QuestionnaireChoice
            checked={value === choice.value}
            disabled={disabled}
            key={choice.value}
            onChange={() => onChange(choice.value)}
            value={choice.value}
          >
            <span className="font-medium">{choice.title}</span>
            {choice.description && (
              <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
            )}
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

export function LanguageActivityModeQuestion({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: "recommended" | "custom") => void;
  value: "recommended" | "custom";
}) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Keep the full mix of reading, listening, words, and sentence activities."),
      title: t("Use the recommended activities"),
      value: "recommended" as const,
    },
    {
      description: t("See what each activity involves and choose which ones to include."),
      title: t("Choose activities"),
      value: "custom" as const,
    },
  ];

  return (
    <QuestionnaireItem name="activityMode" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("Which activities would you like to include?")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("These choices apply only to this course. You can change them anytime.")}
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        {choices.map((choice) => (
          <QuestionnaireChoice
            checked={value === choice.value}
            disabled={disabled}
            key={choice.value}
            onChange={() => onChange(choice.value)}
            value={choice.value}
          >
            <span className="font-medium">{choice.title}</span>
            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

export function LanguageActivitiesQuestion({
  disabled,
  hiddenKinds,
  onChange,
}: {
  disabled: boolean;
  hiddenKinds: HiddenKinds;
  onChange: (value: HiddenKinds) => void;
}) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Learn useful words, like ordering a coffee or greeting someone."),
      icon: MessageSquareIcon,
      kind: "vocabulary" as const,
      title: t("Words and phrases"),
    },
    {
      description: t("See patterns in examples, then use them to build sentences."),
      icon: SpellCheckIcon,
      kind: "grammar" as const,
      title: t("How sentences work"),
    },
    {
      description: t("Read a short text and work out what it means."),
      icon: BookOpenIcon,
      kind: "reading" as const,
      title: t("Reading"),
    },
    {
      description: t("Hear words and conversations, then check what you understood."),
      icon: HeadphonesIcon,
      kind: "listening" as const,
      title: t("Listening"),
    },
    {
      description: t("Express the same idea in your language and the language you're learning."),
      icon: LanguagesIcon,
      kind: "translation" as const,
      title: t("Translation"),
    },
    {
      description: t("Connect written letters with how they sound, when the course includes them."),
      icon: LetterTextIcon,
      kind: "alphabet" as const,
      title: t("Letters and sounds"),
    },
  ];

  return (
    <QuestionnaireItem multiple name="activities" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("Choose your activity mix")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t(
          "Keep at least one. Skipped activities stay available in the full curriculum, and your progress is preserved.",
        )}
      </QuestionnaireDescription>
      <QuestionnaireChoices className="gap-2">
        {choices.map((choice) => (
          <QuestionnaireChoice
            checked={!hiddenKinds.includes(choice.kind)}
            disabled={disabled}
            key={choice.kind}
            onChange={() =>
              onChange(
                hiddenKinds.includes(choice.kind)
                  ? hiddenKinds.filter((kind) => kind !== choice.kind)
                  : [...hiddenKinds, choice.kind],
              )
            }
            value={choice.kind}
          >
            <span className="flex items-center gap-2 font-medium">
              <choice.icon aria-hidden="true" className="size-4 shrink-0" />
              {choice.title}
            </span>
            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
      {!disabled && (
        <QuestionnaireError>{t("Keep at least one activity to continue.")}</QuestionnaireError>
      )}
      <p className="text-muted-foreground text-sm">
        {t(
          "Your path will reflect this mix. Finishing it doesn't assess skills you skip or certify a language level.",
        )}
      </p>
    </QuestionnaireItem>
  );
}
