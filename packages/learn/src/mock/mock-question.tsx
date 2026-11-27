"use client";

import { MAX_ESSAY_CHARACTERS } from "@zoonk/core/exams/essays/contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { InputGroup, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Textarea } from "@zoonk/ui/components/textarea";
import { countWords } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { QuestionTitle } from "../_components/question-title";
import { ESSAY_FIELD_CLASS, useWritingName } from "../essay/essay-labels";
import { EssayWordCount } from "../essay/essay-word-count";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemSupport } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { isMultiPick } from "../questions/pick-rule";
import { WritingLineCount } from "../writing/writing-line-count";
import { WritingQuestionBody } from "../writing/writing-question";
import { useMockScreen } from "./mock-context";
import { isNumberedMockQuestion, useMockQuestionLabel } from "./mock-labels";
import { MockOptions, MockPicks, useLocked } from "./mock-options";

const MAX_TYPED_ANSWER = 500;

const NUMBER_DIGITS = 4;

function MockNumberAnswer({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const locked = useLocked();
  const answer = runner.drafts[question.itemId]?.answer ?? null;

  return (
    <NumericAnswerField
      entry={question.entry}
      grouping={false}
      locked={locked}
      maximumFractionDigits={NUMBER_DIGITS}
      onChange={(value) => runner.write(value === null ? null : { number: value })}
      onSubmit={(value) => runner.answer({ number: value })}
      result={null}
      unit={question.unit}
      value={answer && "number" in answer ? answer.number : null}
    />
  );
}

function MockWordAnswer({ question }: { question: MockQuestion }) {
  const t = useExtracted();
  const inputId = useId();
  const { runner } = useMockScreen();
  const locked = useLocked();
  const answer = runner.drafts[question.itemId]?.answer ?? null;

  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={inputId}>
        {t("Your answer")}
      </label>
      <InputGroup className="bg-background h-14 rounded-lg">
        <InputGroupInput
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          autoFocus
          className="text-lg md:text-lg"
          enterKeyHint="done"
          id={inputId}
          maxLength={MAX_TYPED_ANSWER}
          onChange={(event) => runner.write({ text: event.target.value })}
          readOnly={locked}
          spellCheck={false}
          value={answer && "text" in answer ? answer.text : ""}
        />
      </InputGroup>
    </div>
  );
}

function EssayAnswer({ question }: { question: MockQuestion }) {
  const textId = useId();
  const { runner } = useMockScreen();
  const writingName = useWritingName();
  const answer = runner.drafts[question.itemId]?.answer ?? null;
  const text = answer && "text" in answer ? answer.text : "";
  const words = countWords(text);

  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={textId}>
        {writingName(runner.view.essayRubric ?? "custom")}
      </label>
      <Textarea
        className={ESSAY_FIELD_CLASS}
        aria-describedby={`${textId}-count`}
        id={textId}
        maxLength={MAX_ESSAY_CHARACTERS}
        onChange={(event) => runner.write({ text: event.target.value })}
        readOnly={runner.pending}
        value={text}
      />
      {question.writing ? (
        <WritingLineCount id={`${textId}-count`} text={text} writing={question.writing} />
      ) : (
        <EssayWordCount id={`${textId}-count`} words={words} />
      )}
    </section>
  );
}

export function useQuestionPlace({
  question,
  total,
}: {
  question: MockQuestion;
  total: number;
}): string {
  const t = useExtracted();
  const label = useMockQuestionLabel();

  if (question.format === "essay") {
    if (isNumberedMockQuestion({ question, total })) {
      return label({ number: question.number, total });
    }

    return question.area ? t("Written part · {area}", { area: question.area }) : t("Written part");
  }

  return label({ area: question.area, number: question.number, total });
}

function MockAnswerInput({ question }: { question: MockQuestion }) {
  switch (question.format) {
    case "essay":
      return <EssayAnswer question={question} />;
    case "numeric":
      return <MockNumberAnswer question={question} />;
    case "typed":
      return <MockWordAnswer question={question} />;
    case "multipleChoice":
    case "trueFalse":
      return isMultiPick(question.select) ? (
        <MockPicks question={question} select={question.select} />
      ) : (
        <MockOptions question={question} />
      );
    default:
      return null;
  }
}

/** Keyed by its set, so it keeps playing while the learner answers along, as in the exam. */
export function MockRecording({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const { set } = question;

  if (!set?.listening) {
    return null;
  }

  const onRecording = (runner.view.current?.questions ?? []).filter(
    (other) => other.set?.id === set.id,
  );

  const played = runner.view.current?.plays.find((plays) => plays.setId === set.id)?.played ?? 0;

  return (
    <ItemSetStimulus
      askedIn={runner.view.blockId}
      key={set.id}
      questions={{
        current: onRecording.findIndex((other) => other.itemId === question.itemId),
        prompts: onRecording.map((other) => other.question),
      }}
      served={{ played, record: () => runner.play(set.id) }}
      set={set}
    />
  );
}

export function MockQuestionCard({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const previous = runner.view.current?.questions[runner.position - 1];

  return (
    <div className="flex flex-col gap-4" data-slot="mock-question">
      {question.set && !question.set.listening && (
        <ItemSetStimulus continued={previous?.set?.id === question.set.id} set={question.set} />
      )}

      {question.writing ? (
        // A written question reads as on its practice screen, so its field stays in reach.
        <>
          <QuestionTitle>{question.writing.title}</QuestionTitle>
          <WritingQuestionBody
            className="pb-4"
            question={{
              context: question.context,
              question: question.question,
              writing: question.writing,
            }}
          />
        </>
      ) : (
        <>
          <ItemSupport context={question.context} image={question.image} visual={question.visual} />
          <QuestionTitle text={question.question} />
        </>
      )}

      <MockAnswerInput question={question} />
    </div>
  );
}
