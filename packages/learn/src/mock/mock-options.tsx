"use client";

import { type MockAnswer, type MockChoice } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { ItemLine } from "../questions/item-text";
import { type OptionSelect, PickRule, togglePick } from "../questions/pick-rule";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useMockScreen } from "./mock-context";
import { getOptionMarks } from "./mock-keys";

type Option = { answer: MockChoice | null; key: string; label: string; marker: React.ReactNode };

function isSame(first: MockAnswer | null, second: MockAnswer | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/** A statement can be left blank only where a wrong answer cancels a right one (Cebraspe), and never in a section that asks for an answer before moving on. */
function useOptions(question: MockQuestion): Option[] {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { answerLabel } = useTrueFalseLabels(runner.view.trueFalseLabels);

  if (question.format === "multipleChoice") {
    return (question.options ?? []).map((label, index) => ({
      answer: { selectedIndex: index },
      key: `option-${index}`,
      label,
      marker: index + 1,
    }));
  }

  if (getOptionMarks({ format: question.format, scoring: runner.view.scoring }) === "glyphs") {
    return [
      { answer: { isTrue: true }, key: "true", label: answerLabel(true), marker: <CheckIcon /> },
      { answer: { isTrue: false }, key: "false", label: answerLabel(false), marker: <XIcon /> },
      ...(runner.moves.mustAnswer
        ? []
        : [{ answer: null, key: "blank", label: t("Leave blank"), marker: <MinusIcon /> }]),
    ];
  }

  return [
    { answer: { isTrue: true }, key: "true", label: answerLabel(true), marker: 1 },
    { answer: { isTrue: false }, key: "false", label: answerLabel(false), marker: 2 },
  ];
}

export function MockOptions({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const options = useOptions(question);
  const draft = runner.drafts[question.itemId];
  const hasDraft = draft !== undefined;
  const current = draft?.answer ?? null;
  const locked = !runner.moves.canChange(runner.position);

  function pick(index: number): false | undefined {
    const option = options[index];

    if (!option || runner.pending || locked) {
      return false;
    }

    const alreadyPicked = option.answer !== null && hasDraft && isSame(option.answer, current);

    if (alreadyPicked && runner.moves.mustAnswer) {
      return undefined;
    }

    runner.answer(alreadyPicked ? null : option.answer);
    return undefined;
  }

  useNumberKeys({ count: options.length, onPick: pick });

  return (
    <AnswerOptionGroup>
      {options.map((option, index) => (
        <AnswerOption
          aria-keyshortcuts={String(index + 1)}
          className={cn(option.answer === null && "text-muted-foreground")}
          disabled={locked}
          key={option.key}
          marker={option.marker}
          onClick={() => pick(index)}
          picked={option.answer !== null && hasDraft && isSame(option.answer, current)}
        >
          <ItemLine text={option.label} />
        </AnswerOption>
      ))}
    </AnswerOptionGroup>
  );
}

export function useLocked(): boolean {
  const { runner } = useMockScreen();
  return runner.pending || !runner.moves.canChange(runner.position);
}

export function MockPicks({ question, select }: { question: MockQuestion; select: OptionSelect }) {
  const { runner } = useMockScreen();
  const locked = useLocked();
  const answer = runner.drafts[question.itemId]?.answer ?? null;
  const picks = answer && "selectedIndexes" in answer ? answer.selectedIndexes : [];
  const options = question.options ?? [];

  function toggle(index: number): false | undefined {
    if (locked || index >= options.length) {
      return false;
    }

    const next = togglePick(picks, index);
    runner.answer(next.length > 0 ? { selectedIndexes: next } : null);
    return undefined;
  }

  useNumberKeys({ count: options.length, onPick: toggle });

  return (
    <div className="flex flex-col gap-3">
      <PickRule select={select} />
      <AnswerOptionGroup role="group">
        {options.map((label, index) => (
          <AnswerOption
            aria-checked={picks.includes(index)}
            aria-keyshortcuts={String(index + 1)}
            disabled={locked}
            key={label}
            marker={index + 1}
            onClick={() => toggle(index)}
            picked={picks.includes(index)}
            role="checkbox"
          >
            <ItemLine text={label} />
          </AnswerOption>
        ))}
      </AnswerOptionGroup>
    </div>
  );
}
