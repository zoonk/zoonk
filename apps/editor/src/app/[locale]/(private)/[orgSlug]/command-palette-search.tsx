"use client";

import { CommandInput } from "@zoonk/ui/components/command";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";

export function CommandPaletteSearch() {
  const t = useExtracted();
  const [query, setQuery] = useQueryState("q", {
    defaultValue: "",
    shallow: false,
    throttleMs: 300,
  });

  return (
    <CommandInput
      onValueChange={setQuery}
      placeholder={t("Search courses or pages...")}
      value={query}
    />
  );
}
