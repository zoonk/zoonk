"use client";

import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../../_components/page";
import { type Choice, ChoiceList } from "../choice-list";

export type MaterialIntent = "exam" | "questions" | "understand";

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
      label: t({
        description: "The learner preparing themselves for an exam.",
        message: "Prepare for an exam",
      }),
      value: "exam",
    },
    {
      description: t("Short lessons, in the right order"),
      label: t("Understand this material"),
      value: "understand",
    },
    {
      description: t("Answers show the page they came from"),
      label: t("Ask questions"),
      value: "questions",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <PageSectionTitle>{t("What do you want to do?")}</PageSectionTitle>
      <ChoiceList
        choices={choices}
        label={t("What you want to do with your material")}
        onChange={onChange}
        value={value}
      />
    </section>
  );
}
