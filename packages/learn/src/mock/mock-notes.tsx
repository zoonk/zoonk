"use client";

import { type MockLeftOut, type MockScoreNotes } from "@zoonk/core/exams/mocks/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";

/** Why a part of the real exam isn't in the mock, in one line (see `MockLeftOut`). */
function useLeftOutLine() {
  const t = useExtracted();

  return ({ name, part }: MockLeftOut): string => {
    switch (part) {
      case "listening":
        return name
          ? t("{name} isn't in mocks yet.", { name })
          : t("Listening isn't in mocks yet.");
      case "speaking":
        return name
          ? t("{name} isn't in mocks yet.", { name })
          : t("The speaking part isn't in mocks yet.");
      case "practical":
        return name
          ? t("{name} can't be part of a mock: it's a practical test.", { name })
          : t("The exam's practical test can't be part of a mock.");
      case "numeric":
        return t("Questions answered with a number are asked as multiple choice.");
      case "shortAnswer":
        return t("Questions answered in a few words are asked as multiple choice.");
      case "written":
        return t("There's no essay for {name} yet, so you practice it in your essay sessions.", {
          name: name ?? "",
        });
      case "writtenInFull":
        return t("{name} is only in full mocks.", { name: name ?? "" });
      default:
        return "";
    }
  };
}

function NoteLines({ className, lines }: { className?: string; lines: readonly string[] }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={cn("text-muted-foreground flex flex-col gap-1 text-xs", className)}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/** What a mock leaves out of the real exam, each part with why, as quiet lines. */
export function MockLeftOutNote({
  className,
  leftOut,
}: {
  className?: string;
  leftOut: readonly MockLeftOut[];
}) {
  const line = useLeftOutLine();
  return <NoteLines className={className} lines={leftOut.map((part) => line(part))} />;
}

/**
 * How many of the exam's questions a mock asks, when the bank had too few new ones for all of
 * them (`MockView.examQuestions`); null when it asks them all.
 */
export function useMockShortLine({
  examQuestions,
  questions,
}: {
  examQuestions: number | null;
  questions: number;
}): string | null {
  const t = useExtracted();

  if (examQuestions === null || examQuestions <= questions) {
    return null;
  }

  return t(
    "This mock asks {count, plural, one {# of {total, number} questions} other {# of {total, number} questions}}: there weren't enough new ones yet.",
    { count: questions, total: examQuestions },
  );
}

/** The exam's own scale in one line, with the mock's right answers on it when they convert. */
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

/**
 * What a mock's score says about the real one: the exam's own scale (the right answers on it
 * where they convert) and the score that passes on it, how the notice scores the exam where the
 * mock only counts right answers, and that the real result depends on everyone in the sitting.
 */
export function MockScoreNote({ notes }: { notes: MockScoreNotes }) {
  const t = useExtracted();
  const format = useFormatter();
  const scaleLine = useScaleLine();
  const { scale } = notes;
  const unconverted = scale !== null && scale.score === null;

  const lines = [
    scale && scaleLine(scale),
    scale?.passScore !== null &&
      scale?.passScore !== undefined &&
      t("To pass: {score} or more.", { score: format.number(scale.passScore) }),
    notes.noticeScoring && t("How the real exam scores it: {rule}", { rule: notes.noticeScoring }),
    notes.relative && t("Your real result depends on how everyone in your sitting does."),
    (notes.noticeScoring || notes.relative || unconverted) &&
      t("This mock shows how many you got right."),
  ].filter((text) => typeof text === "string");

  return <NoteLines lines={lines} />;
}
