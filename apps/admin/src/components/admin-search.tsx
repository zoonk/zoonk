"use client";

import { Input } from "@zoonk/ui/components/input";
import { Search } from "lucide-react";
import { useQueryState } from "nuqs";

/**
 * Admin list pages share the same query-param backed search behavior. Keeping
 * it centralized prevents each list from drifting on throttle, shallow routing,
 * or icon/input spacing.
 */
export function AdminSearch({ placeholder }: { placeholder: string }) {
  const [search, setSearch] = useQueryState("search", {
    defaultValue: "",
    shallow: false,
    throttleMs: 300,
  });

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        className="pl-9"
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={search}
      />
    </div>
  );
}
