"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  COMMAND_GROUP_LABEL_CLASS,
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogTitle,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { StatusRegion } from "../_components/status-region";
import { type CountryChoice, type SuggestedCountry } from "./country-choice";
import { foundNoCountry, matchesCountry } from "./country-search";
import { useCountryCatalog } from "./use-country-catalog";

type PickerRow = { country: CountryChoice | null; home: boolean; key: string; label: string };

type PickerGroup = { id: string; items: PickerRow[]; label: string | null };

const SKELETON_ROWS = 6;

function toRows(group: string, countries: readonly (CountryChoice | SuggestedCountry)[]) {
  return countries.map((country): PickerRow => ({
    country,
    home: "tag" in country && country.tag === "home",
    key: `${group}-${country.code}`,
    label: country.name,
  }));
}

/** Suggested rows first while the list is still loading, so a search finds them meanwhile. */
function searchRows({
  catalog,
  query,
  suggested,
}: {
  catalog: readonly CountryChoice[] | null;
  query: string;
  suggested: readonly SuggestedCountry[];
}): PickerRow[] {
  const homeCodes = new Set(
    suggested.filter((country) => country.tag === "home").map((country) => country.code),
  );

  const pool = catalog ?? suggested;

  return toRows("result", pool)
    .filter((row) => matchesCountry({ name: row.label, query }))
    .map((row) => ({ ...row, home: row.home || homeCodes.has(row.country?.code ?? "") }));
}

function PickerOption({
  onPick,
  row,
  selected,
}: {
  onPick: (country: CountryChoice | null) => void;
  row: PickerRow;
  selected: boolean;
}) {
  const t = useExtracted();

  return (
    <CommandItem
      aria-label={
        row.home
          ? t({
              description: "Spoken only. {country} is a country's name.",
              message: "{country}, where you live",
              values: { country: row.label },
            })
          : undefined
      }
      aria-selected={selected}
      className="justify-between"
      onClick={() => onPick(row.country)}
      value={row}
    >
      <span className="min-w-0 text-pretty">{row.label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {row.home && <span className="text-muted-foreground text-xs">{t("Where you live")}</span>}
        {selected && <CheckIcon aria-hidden="true" className="text-foreground" />}
      </span>
    </CommandItem>
  );
}

/** Spoken as the search changes, so a screen reader hears how many rows it left. */
function ResultCount({ count }: { count: number }) {
  const t = useExtracted();

  return count === 0
    ? t("No country found")
    : t("{count, plural, one {# country} other {# countries}}", { count });
}

function CatalogState({ onRetry, status }: { onRetry: () => void; status: "failed" | "loading" }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col px-4 pb-4 sm:px-1.5 sm:pb-1.5">
      <p className={COMMAND_GROUP_LABEL_CLASS}>{t("All countries")}</p>

      {status === "loading" ? (
        Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div className="flex min-h-11 items-center sm:px-2.5" key={index}>
            <Skeleton className="h-4 w-36 rounded" />
          </div>
        ))
      ) : (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 py-2 text-sm sm:px-2.5">
          {t("Couldn't load the list.")}
          <Button onClick={onRetry} type="button" variant="link">
            {t("Try again")}
          </Button>
        </p>
      )}
    </div>
  );
}

/**
 * Picking a row hands it to `onPick` and leaves the picker open: the caller closes it, or keeps it
 * open while it asks to confirm or shows why the save failed (`children`, under the search field).
 * `noneLabel` adds a first row that picks null, for a setting that can be left unset.
 */
export function CountryPicker({
  children,
  finalFocus,
  language,
  noneLabel,
  onOpenChange,
  onPick,
  open,
  suggested,
  title,
  value,
}: {
  children?: React.ReactNode;
  finalFocus?: React.ComponentProps<typeof CommandDialog>["finalFocus"];
  /** The list's names and lesson varieties: a goal's language for its content, else the app's. */
  language: string;
  noneLabel?: string;
  onOpenChange: (open: boolean) => void;
  onPick: (country: CountryChoice | null) => void;
  open: boolean;
  suggested: readonly SuggestedCountry[];
  title: string;
  value: string | null;
}) {
  const t = useExtracted();
  const [query, setQuery] = useState("");
  const catalog = useCountryCatalog({ enabled: open, language });
  const searching = query.trim() !== "";

  const noneRow: PickerRow[] = noneLabel
    ? [{ country: null, home: false, key: "none", label: noneLabel }]
    : [];

  const groups: PickerGroup[] = searching
    ? [
        {
          id: "results",
          items: searchRows({ catalog: catalog.countries, query, suggested }),
          label: null,
        },
      ]
    : [
        { id: "none", items: noneRow, label: null },
        { id: "suggested", items: toRows("suggested", suggested), label: t("Suggested") },
        { id: "all", items: toRows("all", catalog.countries ?? []), label: t("All countries") },
      ].filter((group) => group.items.length > 0);

  const results = searching ? (groups[0]?.items.length ?? 0) : null;
  const noCountry = foundNoCountry({ found: results ?? 0, searching, status: catalog.status });

  const changeOpen = (next: boolean) => {
    if (!next) {
      setQuery("");
    }

    onOpenChange(next);
  };

  return (
    <CommandDialog finalFocus={finalFocus} onOpenChange={changeOpen} open={open} suggestionsFirst>
      <CommandDialogTitle className="not-sr-only px-4 pt-4 text-lg leading-tight font-semibold sm:px-4 sm:pt-3.5 sm:pb-1">
        {title}
      </CommandDialogTitle>

      <Command
        autoHighlight
        inline
        itemToStringValue={(row: PickerRow) => row.label}
        items={groups}
        mode="none"
        onValueChange={setQuery}
        open
        value={query}
      >
        <CommandInput
          aria-label={t("Search countries")}
          autoFocus={false}
          cancelLabel={t("Cancel")}
          placeholder={t("Search countries")}
        />

        {children && <div className="px-4 pb-2 sm:px-4 sm:pt-2">{children}</div>}

        <CommandList
          after={
            <>
              {noCountry && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {t("No country found")}
                </p>
              )}
              {catalog.status !== "ready" && (
                <CatalogState onRetry={catalog.retry} status={catalog.status} />
              )}
            </>
          }
        >
          {groups.map((group) => (
            <CommandGroup items={group.items} key={group.id}>
              {group.label && <CommandGroupLabel>{group.label}</CommandGroupLabel>}
              <CommandCollection>
                {(row: PickerRow) => (
                  <PickerOption
                    key={row.key}
                    onPick={onPick}
                    row={row}
                    selected={(row.country?.code ?? null) === value}
                  />
                )}
              </CommandCollection>
            </CommandGroup>
          ))}
        </CommandList>
      </Command>

      <StatusRegion className="sr-only">
        {results !== null && (results > 0 || noCountry) && <ResultCount count={results} />}
      </StatusRegion>
    </CommandDialog>
  );
}
