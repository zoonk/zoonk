"use client";

import { Link } from "@/i18n/navigation";
import { Input } from "@zoonk/ui/components/input";
import { Spinner } from "@zoonk/ui/components/spinner";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useActionState, useState } from "react";
import { startLanguageCourse } from "./actions";
import { type LanguageOption } from "./language-options";

/**
 * Keeps language filtering in the browser because the full TTS language list is
 * small and already known at render time.
 */
function getVisibleLanguages({
  languages,
  query,
}: {
  languages: LanguageOption[];
  query: string;
}): LanguageOption[] {
  const normalizedQuery = normalizeString(query);

  if (!normalizedQuery) {
    return languages;
  }

  return languages.filter((language) => language.searchText.includes(normalizedQuery));
}

const LANGUAGE_ROW_CLASS =
  "border-border/40 bg-background hover:border-foreground/20 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/40 flex w-full min-w-0 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] disabled:opacity-50";

function LanguageLabel({ language }: { language: LanguageOption }) {
  return (
    <>
      <span aria-hidden="true" className="text-2xl leading-none">
        {language.flag}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{language.name}</span>
        {language.nativeName !== language.name && (
          <span className="text-muted-foreground truncate text-xs">{language.nativeName}</span>
        )}
      </span>
    </>
  );
}

function LanguageOptionRow({
  language,
  pending,
  selected,
  select,
}: {
  language: LanguageOption;
  pending: boolean;
  selected: string | null;
  select: (code: string) => void;
}) {
  const label =
    language.nativeName === language.name
      ? language.name
      : `${language.name}, ${language.nativeName}`;

  const content = <LanguageLabel language={language} />;

  return (
    <div className="flex min-w-0" role="listitem">
      {language.prefetch && !pending ? (
        <Link aria-label={label} className={LANGUAGE_ROW_CLASS} href={language.href} prefetch>
          {content}
        </Link>
      ) : (
        <button
          aria-label={label}
          className={LANGUAGE_ROW_CLASS}
          disabled={pending}
          name="language"
          onClick={() => select(language.code)}
          type="submit"
          value={language.code}
        >
          {content}
          {pending && selected === language.code && <Spinner />}
        </button>
      )}
    </div>
  );
}

/**
 * Provides local search for the supported-language grid without changing the
 * URL or causing a server roundtrip on every keystroke.
 */
export function LanguageList({
  emptyLabel,
  languages,
  searchPlaceholder,
}: {
  emptyLabel: string;
  languages: LanguageOption[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const locale = useLocale();

  const [state, action, pending] = useActionState(startLanguageCourse.bind(null, locale), {
    error: false,
  });

  const t = useExtracted();
  const visibleLanguages = getVisibleLanguages({ languages, query });

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground/60 absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          aria-label={searchPlaceholder}
          className="border-border/40 bg-background h-11 rounded-lg pl-9 focus-visible:ring-[3px]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={query}
        />
      </div>

      {visibleLanguages.length > 0 ? (
        <form action={action}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
            {visibleLanguages.map((language) => (
              <LanguageOptionRow
                key={language.code}
                language={language}
                pending={pending}
                selected={selected}
                select={setSelected}
              />
            ))}
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>
      )}
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {t("Couldn't start this course. Please try again.")}
        </p>
      )}
    </section>
  );
}
