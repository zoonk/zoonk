"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { MatchMisses } from "@zoonk/learn/match-misses";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { type MatchFields, arrangeMatchColumns } from "./match-pairs-columns";
import { boardFromAnswer } from "./match-pairs-progress";

/** The pairs a match activity's answer first got wrong, said under its verdict. */
export function MatchPairsMisses({
  answer,
  fields,
}: {
  answer: ActivityAnswer | null;
  fields: MatchFields;
}) {
  const columns = arrangeMatchColumns(fields);

  return (
    <MatchMisses
      misses={boardFromAnswer(columns, answer)?.misses ?? []}
      renderCard={(side, index) => <LessonRichText text={columns[side][index]?.text ?? ""} />}
    />
  );
}
