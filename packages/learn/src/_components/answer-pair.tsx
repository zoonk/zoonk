"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SpokenMath } from "../rich-text/spoken-math";
import { OptionMarker, ResultTag, TagBesideOrUnder } from "./answer-option";
import { ANSWER_OPTION_CLASS, ANSWER_TONE } from "./answer-tone";

/** An answer shown after the fact: drawn as an option with its result, but nothing to pick. */
function ShownAnswer({
  children,
  marker,
  result,
}: {
  children: React.ReactNode;
  marker: React.ReactNode;
  result: "right" | "wrong";
}) {
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
      <OptionMarker isChecked layout="row" marker={marker} />

      <TagBesideOrUnder
        tag={<ResultTag guessed={false} picked={result === "wrong"} result={result} />}
      >
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
        <ShownAnswer marker={<XIcon />} result="wrong">
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
