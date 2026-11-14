"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { parseAsString, useQueryStates } from "nuqs";

type AdminQuerySelectOption = { label: string; value: string };

export function AdminQuerySelect({
  allLabel,
  clears,
  label,
  name,
  options,
}: {
  allLabel: string;
  /** Another filter whose options depend on this one: a new pick here drops it. */
  clears?: string;
  label: string;
  name: string;
  options: AdminQuerySelectOption[];
}) {
  const [query, setQuery] = useQueryStates(
    { [name]: parseAsString, page: parseAsString, ...(clears && { [clears]: parseAsString }) },
    { shallow: false },
  );

  return (
    <NativeSelect
      aria-label={label}
      className="max-w-60"
      onChange={(event) =>
        setQuery({
          ...(clears && { [clears]: null }),
          [name]: event.target.value || null,
          page: null,
        })
      }
      size="sm"
      value={query[name] ?? ""}
    >
      <NativeSelectOption value="">{allLabel}</NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
