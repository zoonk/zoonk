"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { CheckIcon, CircleDashedIcon, MinusIcon, XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StatTile, StatTiles } from "../_components/stat-tile";

type AnswerCounts = { blank: number; partial: number; right: number; wrong: number };

function getAnswerCounts(result: MockResult): AnswerCounts | null {
  if (result.net) {
    return result.net;
  }

  if (!result.irt) {
    return null;
  }

  return {
    blank: result.blank,
    partial: 0,
    right: result.correct,
    wrong: result.total - result.correct - result.blank,
  };
}

const ANSWER_TILES_CLASS = "flex flex-wrap [&>li]:min-w-max [&>li]:flex-1";

export function MockResultAnswers({ result }: { result: MockResult }) {
  const t = useExtracted();
  const format = useFormatter();
  const counts = getAnswerCounts(result);

  if (!counts && (result.net || result.blank === 0)) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {counts && (
        <StatTiles className={ANSWER_TILES_CLASS}>
          <StatTile
            icon={<CheckIcon />}
            label={t("Right")}
            tone="success"
            value={format.number(counts.right)}
          />
          <StatTile
            icon={<XIcon />}
            label={t("Wrong")}
            tone="danger"
            value={format.number(counts.wrong)}
          />
          {counts.partial > 0 && (
            <StatTile
              icon={<CircleDashedIcon />}
              label={t("Partly right")}
              value={format.number(counts.partial)}
            />
          )}
          <StatTile icon={<MinusIcon />} label={t("Blank")} value={format.number(counts.blank)} />
        </StatTiles>
      )}
      {!result.net && result.blank > 0 && (
        <p className="text-muted-foreground text-xs">
          {result.irt
            ? t("Blank answers count as wrong, as on exam day.")
            : t("Blank answers count as wrong in this score.")}
        </p>
      )}
    </div>
  );
}
