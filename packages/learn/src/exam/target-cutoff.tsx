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

/** Names stand side by side, since the preposition an institution's name takes ("na USP") varies by name. */
export function useCutoffWords() {
  const t = useExtracted();
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

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
    score: (cutoff: TargetCutoff) =>
      t("{score} out of {max}", { max: number(cutoff.maxScore), score: number(cutoff.score) }),
  };
}

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
