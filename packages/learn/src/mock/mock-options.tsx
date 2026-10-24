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

/**
 * One pick: its answer (none for "Leave blank"), its words and its mark: its number, the key that
 * picks it, or, for a statement judged right, wrong or left blank, a glyph (its number key still
 * picks it).
 */
type Option = { answer: MockChoice | null; key: string; label: string; marker: React.ReactNode };

function isSame(first: MockAnswer | null, second: MockAnswer | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * The picks a question offers, statements in the exam's words. Where a wrong answer cancels a right
 * one (Cebraspe), a statement can be left blank, since leaving one blank is a strategy there, but
 * never in a section that asks for an answer before moving on; elsewhere a pick is cleared by
 * tapping it again.
 */
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
  // A question left behind in a section that never goes back keeps its answer.
  const locked = !runner.moves.canChange(runner.position);

  function pick(index: number): false | undefined {
    const option = options[index];

    if (!option || runner.pending || locked) {
      return false;
    }

    const alreadyPicked = option.answer !== null && hasDraft && isSame(option.answer, current);

    // A section that asks for an answer before moving on never clears one.
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
          // Leaving a statement blank clears the pick; an untouched statement is blank too.
          picked={option.answer !== null && hasDraft && isSame(option.answer, current)}
        >
          <ItemLine text={option.label} />
        </AnswerOption>
      ))}
    </AnswerOptionGroup>
  );
}

/** Whether the question on screen can't change: one left behind in a section that never goes back. */
export function useLocked(): boolean {
  const { runner } = useMockScreen();
  return runner.pending || !runner.moves.canChange(runner.position);
}

/**
 * A question that asks for several options: each one toggles, like ticking boxes on the answer
 * sheet, and the picks are saved as they change (none picked is a blank). The rule above says how
 * many to pick, as the exam words it.
 */
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
