"use client";

import { MAX_ESSAY_CHARACTERS } from "@zoonk/core/exams/essays/contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { InputGroup, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Textarea } from "@zoonk/ui/components/textarea";
import { formatLocalizedNumber } from "@zoonk/utils/localized-number";
import { useExtracted, useLocale } from "next-intl";
import { useId } from "react";
import { useWritingName } from "../essay/essay-labels";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemStem, ItemSupport, QUESTION_TEXT_CLASS } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { isMultiPick } from "../questions/pick-rule";
import { useMockScreen } from "./mock-context";
import { MockOptions, MockPicks, useLocked } from "./mock-options";

/** A typed word or short answer is a few words, as the exam's answer box takes it. */
const MAX_TYPED_ANSWER = 500;

/** A number saved before shows with up to this many decimals: two thirds reads 0.6667. */
const NUMBER_DIGITS = 4;

/**
 * A number typed into the question's answer box, by the box's rule (a whole number, n decimals,
 * a fraction), saved a moment after the learner stops typing; one that isn't a number yet is a
 * blank.
 */
function MockNumberAnswer({ question }: { question: MockQuestion }) {
  const locale = useLocale();
  const { runner } = useMockScreen();
  const locked = useLocked();
  const answer = runner.drafts[question.itemId]?.answer ?? null;

  const saved =
    answer && "number" in answer
      ? formatLocalizedNumber({
          grouping: false,
          locale,
          maximumFractionDigits: NUMBER_DIGITS,
          value: answer.number,
        })
      : "";

  return (
    <NumericAnswerField
      defaultText={saved}
      entry={question.entry}
      locked={locked}
      onChange={(value) => runner.write(value === null ? null : { number: value })}
      onSubmit={(value) => runner.answer({ number: value })}
      result={null}
      unit={question.unit}
    />
  );
}

/** A word or short answer typed in, saved a moment after the learner stops typing. */
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
          className="text-lg disabled:opacity-100 md:text-lg"
          disabled={locked}
          enterKeyHint="done"
          id={inputId}
          maxLength={MAX_TYPED_ANSWER}
          onChange={(event) => runner.write({ text: event.target.value })}
          spellCheck={false}
          value={answer && "text" in answer ? answer.text : ""}
        />
      </InputGroup>
    </div>
  );
}

const WORD_PATTERN = /\S+/gu;

/**
 * An essay of a full mock's written part, written on the section's clock: the text is kept as the
 * learner types and saved once they pause, with its word count.
 */
function EssayAnswer({ question }: { question: MockQuestion }) {
  const t = useExtracted();
  const textId = useId();
  const { runner } = useMockScreen();
  const writingName = useWritingName();
  const answer = runner.drafts[question.itemId]?.answer ?? null;
  const text = answer && "text" in answer ? answer.text : "";
  const words = text.match(WORD_PATTERN)?.length ?? 0;

  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={textId}>
        {writingName(runner.view.essayRubric ?? "custom")}
      </label>
      <Textarea
        className="min-h-72 text-base leading-relaxed"
        id={textId}
        maxLength={MAX_ESSAY_CHARACTERS}
        onChange={(event) => runner.write({ text: event.target.value })}
        readOnly={runner.pending}
        value={text}
      />
      {/* Counted from the first word: "0 words" under an empty box says nothing. */}
      <p
        aria-live="polite"
        className="text-muted-foreground min-h-4 font-mono text-xs tabular-nums"
      >
        {words > 0 && t("{count, plural, one {# word} other {# words}}", { count: words })}
      </p>
    </section>
  );
}

/** Where the question sits: its number of the mock's, or the written part an essay belongs to. */
export function useQuestionPlace(question: MockQuestion): string {
  const t = useExtracted();
  const { runner } = useMockScreen();

  if (question.format === "essay") {
    return question.area ? t("Written part · {area}", { area: question.area }) : t("Written part");
  }

  const place = { number: String(question.number), total: String(runner.view.questions) };

  return question.area
    ? t("Question {number} of {total} · {area}", { ...place, area: question.area })
    : t("Question {number} of {total}", place);
}

/** How the question is answered: a pick or several, a number, a word, or an essay. */
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

/**
 * A recording above its set's questions in a listening section. Keyed by its set, it stays mounted
 * from the set's first question to its last, so it keeps playing while the learner answers along,
 * as in the exam. Every play counts in this mock, a reload's too: the exam gives none back. The
 * mock keeps the count, so another tab or device opens it with the same plays left.
 */
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

/**
 * One question of the running section (its place is in the line under the header): the text its
 * set shares (folded on a phone right after another question on it; a recording plays above them
 * all, `MockRecording`), the question and how it's answered (picks, a number, a word), or an
 * essay's prompt and the box to write it in.
 */
export function MockQuestionCard({ question }: { question: MockQuestion }) {
  const { runner } = useMockScreen();
  const previous = runner.view.current?.questions[runner.position - 1];

  return (
    <div className="flex flex-col gap-4" data-slot="mock-question">
      {question.set && !question.set.listening && (
        <ItemSetStimulus continued={previous?.set?.id === question.set.id} set={question.set} />
      )}

      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
      <div className={QUESTION_TEXT_CLASS}>
        <ItemStem text={question.question} heading="h2" />
      </div>

      <MockAnswerInput question={question} />
    </div>
  );
}
