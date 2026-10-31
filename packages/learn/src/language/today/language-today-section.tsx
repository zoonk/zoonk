"use client";

import {
  type LanguageTodayView,
  type NoticedPattern,
} from "@zoonk/core/view-models/language/contract";
import { KeyboardIcon, MicIcon, SparklesIcon } from "lucide-react";
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
          {isTypos ? <KeyboardIcon /> : <SparklesIcon />}
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{isTypos ? t("Just typos") : t("We noticed a pattern")}</ListRowTitle>
        <ListRowDescription>
          {isTypos ? t("Your recent mistakes were slips, not a rule to learn.") : pattern.title}
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

function PracticeNotice({
  action,
  description,
  href,
  label,
  mark,
  summary,
}: {
  action: string;
  description: string;
  href: string;
  label: string;
  mark?: React.ReactNode;
  summary: string;
}) {
  return (
    <Suggestion data-slot="language-practice" label={label} mark={mark}>
      <SuggestionLine>
        <SuggestionSummary>{summary}</SuggestionSummary>
        <SuggestionLinkAction className="shrink-0" href={href} variant="outline">
          {action}
        </SuggestionLinkAction>
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{label}</SuggestionHeader>
        <SuggestionDescription>{description}</SuggestionDescription>
        <SuggestionActions>
          <SuggestionLinkAction href={href} variant="outline">
            {action}
          </SuggestionLinkAction>
        </SuggestionActions>
      </SuggestionContent>
    </Suggestion>
  );
}

export function LanguagePracticeRow({
  hrefs,
  today,
}: {
  hrefs: { pattern: string | null; pronunciation: string };
  today: { pattern: NoticedPattern | null; pronunciation: LanguageTodayView["pronunciation"] };
}) {
  const t = useExtracted();
  const format = useFormatter();
  const { pattern, pronunciation } = today;

  if (pronunciation) {
    const title = t("{count, plural, one {Say # word again} other {Say # words again}}", {
      count: pronunciation.count,
    });

    return (
      <PracticeNotice
        action={t("Say them")}
        description={format.list(pronunciation.words, { type: "conjunction" })}
        href={hrefs.pronunciation}
        label={title}
        mark={<MicIcon />}
        summary={title}
      />
    );
  }

  if (!pattern || !hrefs.pattern) {
    return null;
  }

  if (pattern.kind === "typos") {
    return (
      <PracticeNotice
        action={t("Open")}
        description={t("Your recent mistakes were slips, not a rule to learn.")}
        href={hrefs.pattern}
        label={t("Just typos")}
        mark={<KeyboardIcon />}
        summary={t("Your recent mistakes were slips, not a rule to learn.")}
      />
    );
  }

  return (
    <PracticeNotice
      action={t("Practice it")}
      description={pattern.title}
      href={hrefs.pattern}
      label={t("We noticed a pattern")}
      summary={t("We noticed a pattern: {pattern}", { pattern: pattern.title })}
    />
  );
}
