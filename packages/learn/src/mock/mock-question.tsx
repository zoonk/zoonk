"use client";

import { type MockChoice, type MockQuestion } from "@zoonk/core/exams/mocks/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ANSWER_LETTERS, AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { ItemLine, ItemSupport } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useMockScreen } from "./mock-context";

type Option = { answer: MockChoice | null; key: string; label: string; marker: React.ReactNode };

function isSame(first: MockChoice | null, second: MockChoice | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * The picks a question offers, statements in the exam's words. Where a wrong answer cancels a right
 * one (Cebraspe), a statement can be left blank, since leaving one blank is a strategy there;
 * elsewhere a pick is cleared by tapping it again.
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
      marker: ANSWER_LETTERS[index],
    }));
  }

  if (runner.view.scoring === "net") {
    return [
      { answer: { isTrue: true }, key: "true", label: answerLabel(true), marker: <CheckIcon /> },
      { answer: { isTrue: false }, key: "false", label: answerLabel(false), marker: <XIcon /> },
      { answer: null, key: "blank", label: t("Leave blank"), marker: <MinusIcon /> },
    ];
  }

  return [
    { answer: { isTrue: true }, key: "true", label: answerLabel(true), marker: "A" },
    { answer: { isTrue: false }, key: "false", label: answerLabel(false), marker: "B" },
  ];
}

function MockOptions({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const options = useOptions(question);
  const draft = runner.drafts[question.itemId];
  const hasDraft = draft !== undefined;
  const current = draft?.answer ?? null;

  function pick(index: number): false | undefined {
    const option = options[index];

    if (!option || runner.pending) {
      return false;
    }

    const alreadyPicked = option.answer !== null && hasDraft && isSame(option.answer, current);
    runner.answer(alreadyPicked ? null : option.answer);
    return undefined;
  }

  useNumberKeys({ count: options.length, onPick: pick });

  return (
    <AnswerOptionGroup>
      {options.map((option, index) => (
        <AnswerOption
          className={cn(option.answer === null && "border-dashed")}
          key={option.key}
          marker={option.marker}
          onClick={() => pick(index)}
          // Leaving a statement blank clears the pick; an untouched statement is blank too.
          picked={option.answer !== null && hasDraft && isSame(option.answer, current)}
        >
          {option.label}
        </AnswerOption>
      ))}
    </AnswerOptionGroup>
  );
}

/** One question of the running section: its place in the mock, the question and the picks. */
export function MockQuestionCard({ question }: { question: MockQuestion }) {
  const t = useExtracted();
  const { runner } = useMockScreen();

  return (
    <div className="flex flex-col gap-4" data-slot="mock-question">
      <p className="text-muted-foreground text-sm">
        {question.area
          ? t("Question {number} of {total} · {area}", {
              area: question.area,
              number: String(question.number),
              total: String(runner.view.questions),
            })
          : t("Question {number} of {total}", {
              number: String(question.number),
              total: String(runner.view.questions),
            })}
      </p>

      <ItemSupport
        className="text-muted-foreground"
        context={question.context}
        image={question.image}
        visual={question.visual}
      />
      <h2 className="text-lg leading-snug font-semibold text-balance sm:text-xl">
        <ItemLine text={question.question} />
      </h2>

      <MockOptions question={question} />
    </div>
  );
}
