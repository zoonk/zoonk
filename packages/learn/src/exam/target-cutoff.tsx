"use client";

import { type TargetCutoff } from "@zoonk/core/exams/cutoffs/contract";
import { TargetIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { getSourceHost } from "../_utils/source-host";

/**
 * A cut-off as the learner reads it: its score in their number format, and what it's for in a few
 * words ("Medicina · UFMG · Sisu 2025 · ampla concorrência"), each part as the source names it.
 * Names stand side by side, without the prepositions an institution's name decides ("na USP").
 */
export function useCutoffWords() {
  const format = useFormatter();

  return {
    detail: (cutoff: TargetCutoff) =>
      [
        cutoff.course,
        cutoff.position,
        cutoff.course ? cutoff.institution : null,
        cutoff.edition,
        cutoff.quota,
      ]
        .filter((part) => part !== null && part.trim() !== "")
        .join(" · "),
    score: (cutoff: TargetCutoff) => format.number(cutoff.score, { maximumFractionDigits: 1 }),
  };
}

/** What the cut-off is for, then its page as a quiet link named by its site. */
function CutoffDetail({ cutoff }: { cutoff: TargetCutoff }) {
  const t = useExtracted();
  const words = useCutoffWords();

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={cutoff.source.url}
      rel="noreferrer"
      target="_blank"
      title={cutoff.source.title ?? undefined}
    >
      {chunks}
    </a>
  );

  return t.rich("{detail}, according to <link>{site}</link>", {
    detail: words.detail(cutoff),
    link,
    site: getSourceHost(cutoff.source.url),
  });
}

/**
 * Where the bar was for the learner's target, as a row of "How the score works": the last published
 * cut-off with what it's for and its source, and the learner's own goal. A reference, never a
 * promise, so it says nothing about their chances. Nothing when no source published one.
 */
export function TargetCutoffRow({
  cutoff,
  targetScore,
}: {
  cutoff: TargetCutoff | null;
  targetScore: string | null;
}) {
  const t = useExtracted();
  const words = useCutoffWords();

  if (!cutoff) {
    return null;
  }

  return (
    <ListRow aria-label={t("Last cut-off")} role="note">
      <ListRowLeading>
        <ListRowIcon>
          <TargetIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="tabular-nums">
          {t("Last cut-off: {score}", { score: words.score(cutoff) })}
        </ListRowTitle>
        <ListRowDescription className="[&_a]:underline [&_a]:underline-offset-2">
          <CutoffDetail cutoff={cutoff} />
        </ListRowDescription>
        {targetScore && (
          <ListRowDescription>
            {t("Your goal: {target}", { target: targetScore })}
          </ListRowDescription>
        )}
      </ListRowContent>
    </ListRow>
  );
}
