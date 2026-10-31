"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { parseAsString, useQueryStates } from "nuqs";

type AdminQuerySelectOption = { label: string; value: string };

export function AdminQuerySelect({
  allLabel,
  label,
  name,
  options,
}: {
  allLabel: string;
  label: string;
  name: string;
  options: AdminQuerySelectOption[];
}) {
  const [query, setQuery] = useQueryStates(
    { page: parseAsString, [name]: parseAsString },
    { shallow: false },
  );

  return (
    <NativeSelect
      aria-label={label}
      className="max-w-60"
      onChange={(event) => setQuery({ page: null, [name]: event.target.value || null })}
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
