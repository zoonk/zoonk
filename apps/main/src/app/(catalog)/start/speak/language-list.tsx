"use client";

import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

/**
 * Renders one compact language row as the link target so selecting a language
 * uses normal navigation, prefetching, and keyboard behavior.
 */
function LanguageOptionLink({ language }: { language: LanguageOption }) {
  const hasNativeName = language.nativeName !== language.name;

  return (
    <div className="flex min-w-0" role="listitem">
      <Link
        aria-label={hasNativeName ? `${language.name}, ${language.nativeName}` : language.name}
        className={cn(
          "border-border/40 bg-background hover:border-foreground/20 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/40 flex w-full min-w-0 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150 outline-none focus-visible:ring-[3px]",
        )}
        href={language.href}
        prefetch={false}
        rel="nofollow"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          {language.flag}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{language.name}</span>
          {hasNativeName && (
            <span className="text-muted-foreground truncate text-xs">{language.nativeName}</span>
          )}
        </span>
      </Link>
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
          {visibleLanguages.map((language) => (
            <LanguageOptionLink key={language.code} language={language} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>
      )}
    </section>
  );
}
