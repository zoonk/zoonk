"use client";

import {
  type LanguageTodayView,
  type NoticedPattern,
} from "@zoonk/core/view-models/language/contract";
import { KeyboardIcon, MicIcon, SparkleIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../../_components/list-group";
import {
  Suggestion,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionSummary,
} from "../../_components/suggestion";

type Pronunciation = NonNullable<LanguageTodayView["pronunciation"]>;

export function PatternRow({ href, pattern }: { href: string; pattern: NoticedPattern }) {
  const t = useExtracted();
  const isTypos = pattern.kind === "typos";

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon className={isTypos ? undefined : "text-warning"}>
          {isTypos ? <KeyboardIcon /> : <SparkleIcon />}
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{isTypos ? t("Just typos") : t("We noticed a pattern")}</ListRowTitle>
        <ListRowDescription>
          {isTypos ? t("Your recent mistakes were typos, not a rule to learn.") : pattern.title}
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

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
      <ListRowLeading>
        <ListRowIcon>
          <MicIcon />
        </ListRowIcon>
      </ListRowLeading>
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

/** Today's notice when mispronounced words are due to be said again. */
export function PronunciationNotice({
  href,
  pronunciation,
}: {
  href: string;
  pronunciation: Pronunciation;
}) {
  const t = useExtracted();
  const format = useFormatter();

  const title = t("{count, plural, one {Say # word again} other {Say # words again}}", {
    count: pronunciation.count,
  });

  return (
    <Suggestion label={title} mark={<MicIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{title}</SuggestionSummary>
        <SuggestionLinkAction className="shrink-0" href={href} variant="outline">
          {t("Say them")}
        </SuggestionLinkAction>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>
          {format.list(pronunciation.words, { type: "conjunction" })}
        </SuggestionDescription>
        <SuggestionActions>
          <SuggestionLinkAction href={href} variant="outline">
            {t("Say them")}
          </SuggestionLinkAction>
        </SuggestionActions>
      </SuggestionContent>
    </Suggestion>
  );
}
