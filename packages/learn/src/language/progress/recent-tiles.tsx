"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { StatTile, StatTileLabel, StatTileValue } from "../../_components/stat-tile";

/**
 * The learner's own numbers: every word known so far, then the last four weeks in new words,
 * minutes spoken and calls held.
 */
export function RecentTiles({
  recent,
  wordsKnown,
}: Pick<LanguageProgressView, "recent" | "wordsKnown">) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-5">
      <StatTile className="flex-row items-baseline justify-center gap-2 py-4">
        <StatTileValue className="text-2xl">
          {t("{count, number}", { count: wordsKnown })}
        </StatTileValue>
        <StatTileLabel className="text-sm">
          {t("{count, plural, one {word known} other {words known}}", { count: wordsKnown })}
        </StatTileLabel>
      </StatTile>

      <section aria-labelledby="language-recent" className="flex flex-col gap-3">
        <SectionLabel id="language-recent">{t("In the last 4 weeks")}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatTile>
            <StatTileValue>{t("{count, number}", { count: recent.wordsLearned })}</StatTileValue>
            <StatTileLabel>
              {t("{count, plural, one {new word} other {new words}}", {
                count: recent.wordsLearned,
              })}
            </StatTileLabel>
          </StatTile>
          <StatTile>
            <StatTileValue>
              {t("{minutes, number} min", { minutes: recent.minutesSpoken })}
            </StatTileValue>
            <StatTileLabel>{t("speaking")}</StatTileLabel>
          </StatTile>
          <StatTile>
            <StatTileValue>{t("{count, number}", { count: recent.conversations })}</StatTileValue>
            <StatTileLabel>
              {t("{count, plural, one {conversation} other {conversations}}", {
                count: recent.conversations,
              })}
            </StatTileLabel>
          </StatTile>
        </div>
      </section>
    </div>
  );
}
