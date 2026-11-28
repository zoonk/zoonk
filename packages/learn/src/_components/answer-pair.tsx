"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpokenMath } from "../rich-text/spoken-math";
import { OptionMarker, TagBesideOrUnder, useAnswerTag } from "./answer-option";
import { ANSWER_OPTION_CLASS, ANSWER_TONE } from "./answer-tone";

/** An answer shown after the fact: drawn as an option with its result, but nothing to pick. */
function ShownAnswer({
  children,
  label,
  marker,
  result,
}: {
  children: React.ReactNode;
  /** Says whose answer it is to a screen reader, which can't see its mark. */
  label?: string;
  marker: React.ReactNode;
  result: "right" | "wrong";
}) {
  const tag = useAnswerTag({ guessed: false, picked: result === "wrong", result });

  return (
    <div
      className={cn(
        ANSWER_OPTION_CLASS,
        "flex-wrap",
        result === "right" ? ANSWER_TONE.right : ANSWER_TONE.wrong,
      )}
      data-result={result}
      data-slot="answer-option"
    >
      <OptionMarker layout="row" marker={marker} picked={false} />

      <TagBesideOrUnder tag={tag}>
        {label && <span className="sr-only">{label}</span>}
        <SpokenMath>{children}</SpokenMath>
      </TagBesideOrUnder>
    </div>
  );
}

/** What the learner answered over the right answer, after the fact: a mock's review, the notebook. */
export function AnswerPair({
  right,
  yours,
}: {
  right: React.ReactNode | null;
  yours: React.ReactNode | null;
}) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Your answer and the right one")}
      className="flex flex-col gap-2"
      role="group"
    >
      {yours !== null && (
        <ShownAnswer label={t("Your answer")} marker={<XIcon />} result="wrong">
          {yours}
        </ShownAnswer>
      )}
      {right !== null && (
        <ShownAnswer marker={<CheckIcon />} result="right">
          {right}
        </ShownAnswer>
      )}
    </div>
  );
}
