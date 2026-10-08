"use client";

import {
  LANGUAGE_MISTAKE_SKILLS,
  type LanguageMistakeSkill,
  type LanguageUnitView,
} from "@zoonk/core/view-models/language/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";

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
  const t = useExtracted();

  return (
    <li className="bg-background flex flex-col gap-1.5 rounded-2xl p-3">
      <p className="text-sm font-medium">{mistake.question}</p>
      {mistake.answer && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <XIcon
            aria-label={t("Your answer")}
            className="text-destructive mt-0.5 size-4 shrink-0"
          />
          <s className="decoration-destructive/50">{mistake.answer}</s>
        </p>
      )}
      {mistake.correctAnswer && (
        <p className="flex items-start gap-2 text-sm font-medium">
          <CheckIcon
            aria-label={t("Right answer")}
            className="text-success mt-0.5 size-4 shrink-0"
          />
          {mistake.correctAnswer}
        </p>
      )}
      {mistake.explanation && (
        <p className="text-muted-foreground text-sm">{mistake.explanation}</p>
      )}
    </li>
  );
}

function SkillFilters({
  mistakes,
  onChange,
  selected,
}: {
  mistakes: UnitMistake[];
  onChange: (skill: LanguageMistakeSkill | null) => void;
  selected: LanguageMistakeSkill | null;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const labels = useSkillLabels();

  return (
    <div
      aria-label={t("Show mistakes in")}
      className="bg-background grid grid-cols-4 gap-1 rounded-2xl p-1"
      role="group"
    >
      {LANGUAGE_MISTAKE_SKILLS.map((skill) => {
        const count = mistakes.filter((mistake) => mistake.skill === skill).length;
        const isSelected = selected === skill;

        return (
          <button
            aria-pressed={isSelected}
            className={cn(
              "focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1 outline-none focus-visible:ring-[3px] disabled:opacity-50",
              isSelected ? "bg-muted" : "text-muted-foreground",
            )}
            disabled={count === 0}
            key={skill}
            onClick={() => onChange(isSelected ? null : skill)}
            type="button"
          >
            <span className="text-sm font-semibold tabular-nums">{format.number(count)}</span>
            <span className="w-full truncate text-center text-xs">{labels[skill]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The learner's open mistakes on this unit, filtered by words, listening, speaking or writing.
 * Each shows the question, what they answered, the right answer and why.
 */
export function UnitMistakes({ mistakes }: { mistakes: UnitMistake[] }) {
  const t = useExtracted();
  const labels = useSkillLabels();
  const [skill, setSkill] = useState<LanguageMistakeSkill | null>(null);
  const shown = skill ? mistakes.filter((mistake) => mistake.skill === skill) : mistakes;

  return (
    <>
      <SkillFilters mistakes={mistakes} onChange={setSkill} selected={skill} />
      <ul
        aria-label={skill ? labels[skill] : t("All mistakes")}
        aria-live="polite"
        className="flex flex-col gap-2"
      >
        {shown.map((mistake) => (
          <MistakeItem key={mistake.id} mistake={mistake} />
        ))}
      </ul>
    </>
  );
}
