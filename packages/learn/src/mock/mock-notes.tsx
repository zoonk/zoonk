"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import {
  type MockLeftOut,
  type MockScoreNotes,
  type MockSizeSource,
} from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { QuestionsSourceText } from "../_components/questions-source-text";
import { useFormatDuration } from "../_utils/time-format";

type AboutView = Pick<
  MockView,
  | "examDocument"
  | "examQuestions"
  | "leftOut"
  | "minutes"
  | "questions"
  | "reusedQuestions"
  | "scoreNotes"
  | "sizeSource"
>;

function useLeftOutLine() {
  const t = useExtracted();

  return ({ name, part }: MockLeftOut): string => {
    switch (part) {
      case "choice":
        return t({
          description:
            "{name} is a part of the exam, such as a specialty's own test, that the learner hasn't picked an option for yet.",
          message: "{name} isn't in it until you pick which one you take.",
          values: { name: name ?? "" },
        });
      case "listening":
        return name
          ? t("{name} isn't in mock exams yet.", { name })
          : t("Listening isn't in mock exams yet.");
      case "speaking":
        return name
          ? t("{name} isn't in mock exams yet.", { name })
          : t("The speaking part isn't in mock exams yet.");
      case "practical":
        return name
          ? t("{name} can't be part of a mock exam.", { name })
          : t("The practical test can't be part of a mock exam.");
      case "written":
        return t("{name} isn't in mock exams yet.", { name: name ?? "" });
      case "writtenInFull":
        return t("{name} is only in full mock exams.", { name: name ?? "" });
      case "numeric":
      case "shortAnswer":
        return "";
      default:
        return part satisfies never;
    }
  };
}

function useScaleLine() {
  const t = useExtracted();
  const format = useFormatter();

  return (scale: NonNullable<MockScoreNotes["scale"]>): string => {
    const range = { max: format.number(scale.max), min: format.number(scale.min) };

    if (scale.score === null) {
      return scale.name
        ? t("The real exam scores on the {name} scale, from {min} to {max}.", {
            ...range,
            name: scale.name,
          })
        : t("The real exam scores from {min} to {max}.", range);
    }

    const score = format.number(scale.score);

    return scale.name
      ? t("About {score} on the {name} scale, from {min} to {max}.", {
          ...range,
          name: scale.name,
          score,
        })
      : t("About {score} on the exam's scale, from {min} to {max}.", { ...range, score });
  };
}

function useScoreLines(notes: MockScoreNotes): string[] {
  const t = useExtracted();
  const format = useFormatter();
  const scaleLine = useScaleLine();
  const { scale } = notes;
  const unconverted = scale !== null && scale.score === null;

  return [
    scale && scaleLine(scale),
    scale?.passScore !== null &&
      scale?.passScore !== undefined &&
      t("To pass: {score} or more.", { score: format.number(scale.passScore) }),
    notes.noticeScoring && t("How the real exam scores it: {rule}", { rule: notes.noticeScoring }),
    notes.relative && t("The real exam ranks you against the other candidates."),
    (notes.noticeScoring || notes.relative || unconverted) &&
      t("This mock exam shows how many you got right."),
  ].filter((text) => typeof text === "string");
}

function useSizeLine(view: AboutView): string | null {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { sizeSource: source } = view;

  if (source.questions === "notice" && source.time === "notice") {
    return null;
  }

  const size = { count: view.questions, time: duration(view.minutes) };

  if (source.material) {
    return t(
      "Your material doesn't say the test's size, so this mock exam used {count, plural, one {# question} other {# questions}} in {time}.",
      size,
    );
  }

  return t({
    description:
      "The notice branch is for an exam whose official document is a public notice (Portuguese: edital).",
    message:
      "{document, select, notice {The official guide doesn't say the exam's size, so this mock exam used {count, plural, one {# question} other {# questions}} in {time}.} other {The official guide doesn't say the exam's size, so this mock exam used {count, plural, one {# question} other {# questions}} in {time}.}}",
    values: { ...size, document: view.examDocument },
  });
}

function PastEditionLine({ source }: { source: NonNullable<MockSizeSource["pastEdition"]> }) {
  return (
    <p>
      <QuestionsSourceText source={source} />
    </p>
  );
}

function useAboutLines(view: AboutView): string[] {
  const t = useExtracted();
  const scoreLines = useScoreLines(view.scoreNotes);
  const sizeLine = useSizeLine(view);
  const leftOutLine = useLeftOutLine();
  const { examQuestions, questions, reusedQuestions } = view;

  return [
    ...scoreLines,
    examQuestions !== null &&
      examQuestions > questions &&
      t(
        "This mock exam had {count, plural, one {# of the exam's {total, number} questions} other {# of the exam's {total, number} questions}}.",
        { count: questions, total: examQuestions },
      ),
    sizeLine,
    reusedQuestions > 0 &&
      t("{count, plural, one {# question was a repeat.} other {# questions were repeats.}}", {
        count: reusedQuestions,
      }),
    ...view.leftOut.map((part) => leftOutLine(part)),
  ].filter((line): line is string => typeof line === "string" && line !== "");
}

/**
 * Everything that qualifies how to read a mock exam's result, said once, in its details: the
 * chooser, the intro and the running mock exam say none of it.
 */
export function useMockAbout(view: AboutView): React.ReactNode {
  const lines = useAboutLines(view);
  const { pastEdition } = view.sizeSource;

  if (lines.length === 0 && !pastEdition) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-col gap-1.5 text-sm">
      {[...new Set(lines)].map((line) => (
        <p className="text-pretty" key={line}>
          {line}
        </p>
      ))}
      {pastEdition && <PastEditionLine source={pastEdition} />}
    </div>
  );
}
