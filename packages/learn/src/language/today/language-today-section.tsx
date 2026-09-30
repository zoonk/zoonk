"use client";

import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { cn } from "@zoonk/ui/lib/utils";
import {
  ChevronRightIcon,
  KeyboardIcon,
  MicIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { LearnLink } from "../../learn-link";
import { CurrentUnitSection, LANGUAGE_ROW_LINK_CLASS } from "../current-unit";

/** Where the rows lead; the host builds them from the view model's ids. */
type LanguageTodayHrefs = {
  /** The "I can already" list, on Progress. */
  canDo: string;
  pattern: string | null;
  /** The words to say again today. */
  pronunciation: string;
  unit: string | null;
};

function RowIcon({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4.5",
        "in-data-[mode=fun]:bg-fun-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

function RowText({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-muted-foreground truncate text-xs">{subtitle}</span>
    </span>
  );
}

function RowChevron() {
  return <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />;
}

function NewCanDoRow({ href, text }: { href: string; text: string }) {
  const t = useExtracted();

  return (
    <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={href}>
      <RowIcon className="bg-success/10 text-success in-data-[mode=fun]:text-fun-accent-lime">
        <TrendingUpIcon />
      </RowIcon>
      <RowText subtitle={text} title={t("New in “I can already…”")} />
      <RowChevron />
    </LearnLink>
  );
}

function PatternRow({
  href,
  pattern,
}: {
  href: string;
  pattern: NonNullable<LanguageTodayView["pattern"]>;
}) {
  const t = useExtracted();
  const isTypos = pattern.kind === "typos";

  return (
    <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={href}>
      <RowIcon className="bg-info/10 text-info in-data-[mode=fun]:text-fun-accent-violet">
        {isTypos ? <KeyboardIcon /> : <SparklesIcon />}
      </RowIcon>
      {isTypos ? (
        <RowText
          subtitle={t("Your recent mistakes were slips, not a rule to learn.")}
          title={t("Just typos")}
        />
      ) : (
        <RowText subtitle={pattern.title} title={t("We noticed a pattern")} />
      )}
      <RowChevron />
    </LearnLink>
  );
}

function PronunciationRow({
  href,
  pronunciation,
}: {
  href: string;
  pronunciation: NonNullable<LanguageTodayView["pronunciation"]>;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={href}>
      <RowIcon className="bg-warning/10 text-warning in-data-[mode=fun]:text-fun-accent-amber">
        <MicIcon />
      </RowIcon>
      <RowText
        subtitle={format.list(pronunciation.words, { type: "conjunction" })}
        title={t("{count, plural, one {Say # word again} other {Say # words again}}", {
          count: pronunciation.count,
        })}
      />
      <RowChevron />
    </LearnLink>
  );
}

/**
 * What Today adds for a language goal, in both modes: the situation the learner is in, a new
 * "I can" from a unit finished this week, a pattern noticed in recent mistakes (or the kind
 * note that they were only typos), and the words mispronounced earlier that are due to be said
 * again. Nothing renders when there's nothing to show.
 */
export function LanguageToday({
  hrefs,
  today,
}: {
  hrefs: LanguageTodayHrefs;
  today: LanguageTodayView;
}) {
  const { currentUnit, newCanDo, pattern, pronunciation } = today;
  const unitHref = currentUnit ? hrefs.unit : null;
  const patternHref = pattern ? hrefs.pattern : null;

  if (!unitHref && !newCanDo && !patternHref && !pronunciation) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col gap-3" data-slot="language-today">
      {currentUnit && unitHref && <CurrentUnitSection href={unitHref} unit={currentUnit} />}
      {newCanDo && <NewCanDoRow href={hrefs.canDo} text={newCanDo} />}
      {pattern && patternHref && <PatternRow href={patternHref} pattern={pattern} />}
      {pronunciation && (
        <PronunciationRow href={hrefs.pronunciation} pronunciation={pronunciation} />
      )}
    </div>
  );
}
