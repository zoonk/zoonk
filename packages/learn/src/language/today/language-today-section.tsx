"use client";

import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { KeyboardIcon, MicIcon, SparklesIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLink,
  ListRowTitle,
} from "../../_components/list-group";

type Pattern = NonNullable<LanguageTodayView["pattern"]>;
type Pronunciation = NonNullable<LanguageTodayView["pronunciation"]>;

/** A pattern noticed in recent mistakes (or that they were only typos), as a row of a list. */
export function PatternRow({ href, pattern }: { href: string; pattern: Pattern }) {
  const t = useExtracted();
  const isTypos = pattern.kind === "typos";

  return (
    <ListRowLink href={href}>
      <ListRowIcon className="bg-info/10 text-info">
        {isTypos ? <KeyboardIcon /> : <SparklesIcon />}
      </ListRowIcon>
      <ListRowContent>
        <ListRowTitle>{isTypos ? t("Just typos") : t("We noticed a pattern")}</ListRowTitle>
        <ListRowDescription>
          {isTypos ? t("Your recent mistakes were slips, not a rule to learn.") : pattern.title}
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

/** The words to say again today, as a row of a list. */
export function PronunciationRow({
  href,
  pronunciation,
}: {
  href: string;
  pronunciation: Pronunciation;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <ListRowLink href={href}>
      <ListRowIcon className="bg-warning/10 text-warning">
        <MicIcon />
      </ListRowIcon>
      <ListRowContent>
        <ListRowTitle>
          {t("{count, plural, one {Say # word again} other {Say # words again}}", {
            count: pronunciation.count,
          })}
        </ListRowTitle>
        <ListRowDescription className="truncate">
          {format.list(pronunciation.words, { type: "conjunction" })}
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

/**
 * A language goal's practice that's due, as one row on Today: the words mispronounced earlier that
 * are due to be said again (they're due today), else a pattern noticed in recent mistakes (or the
 * kind note that they were only typos), which waits a week. The host renders it only when there's
 * one, as Today's notice.
 */
export function LanguagePracticeRow({
  hrefs,
  today,
}: {
  hrefs: { pattern: string | null; pronunciation: string };
  today: Pick<LanguageTodayView, "pattern" | "pronunciation">;
}) {
  if (today.pronunciation) {
    return (
      <ListGroup>
        <PronunciationRow href={hrefs.pronunciation} pronunciation={today.pronunciation} />
      </ListGroup>
    );
  }

  if (today.pattern && hrefs.pattern) {
    return (
      <ListGroup>
        <PatternRow href={hrefs.pattern} pattern={today.pattern} />
      </ListGroup>
    );
  }

  return null;
}
