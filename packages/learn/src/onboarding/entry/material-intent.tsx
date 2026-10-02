"use client";

import { CalendarClockIcon, LayersIcon, MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type Choice, ChoiceList } from "../choice-list";

/**
 * What the learner wants from the material they attached: an exam on it with a date, lessons
 * that teach it in order, or answers to their questions about it.
 */
export type MaterialIntent = "exam" | "questions" | "understand";

/** "What do you want to do?", once material is attached. */
export function MaterialIntentChoice({
  onChange,
  value,
}: {
  onChange: (intent: MaterialIntent) => void;
  value: MaterialIntent | null;
}) {
  const t = useExtracted();

  const choices: Choice<MaterialIntent>[] = [
    {
      description: t("Give a date and we'll plan up to it"),
      icon: <CalendarClockIcon />,
      label: t("Prepare for an exam"),
      value: "exam",
    },
    {
      description: t("Short lessons, in the right order"),
      icon: <LayersIcon />,
      label: t("Understand this material"),
      value: "understand",
    },
    {
      description: t("Answers show the page they came from"),
      icon: <MessageCircleQuestionIcon />,
      label: t("Ask questions"),
      value: "questions",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{t("What do you want to do?")}</h2>
      <ChoiceList
        choices={choices}
        label={t("What you want to do with your material")}
        onChange={onChange}
        value={value}
      />
    </section>
  );
}
