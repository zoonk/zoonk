"use client";

import {
  type LanguageMistakeSkill,
  type LanguageUnitView,
} from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import { MistakeAnswer } from "../../mistakes/mistake-entry";
import { ItemStem, ItemText } from "../../questions/item-text";

type UnitMistake = LanguageUnitView["mistakes"][number];

function useSkillLabels(): Record<LanguageMistakeSkill, string> {
  const t = useExtracted();

  return {
    listening: t("Listening"),
    speaking: t("Speaking"),
    words: t("Words"),
    writing: t("Writing"),
  };
}

function MistakeItem({ mistake }: { mistake: UnitMistake }) {
  const labels = useSkillLabels();

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <p className="text-muted-foreground text-xs font-medium">{labels[mistake.skill]}</p>
      <div className="text-sm font-medium">
        <ItemStem text={mistake.question} />
      </div>
      {mistake.answer && <MistakeAnswer kind="learner">{mistake.answer}</MistakeAnswer>}
      {mistake.correctAnswer && <MistakeAnswer kind="right">{mistake.correctAnswer}</MistakeAnswer>}
      {mistake.explanation && (
        <ItemText className="text-muted-foreground text-sm" text={mistake.explanation} />
      )}
    </li>
  );
}

export function UnitMistakes({ mistakes }: { mistakes: UnitMistake[] }) {
  const t = useExtracted();

  return (
    <ul aria-label={t("All mistakes")} className="divide-border flex flex-col divide-y">
      {mistakes.map((mistake) => (
        <MistakeItem key={mistake.id} mistake={mistake} />
      ))}
    </ul>
  );
}
