"use client";

import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { SEARCH_QUERY_THROTTLE_MS } from "@zoonk/utils/search";
import { Search } from "lucide-react";
import { parseAsString, throttle, useQueryStates } from "nuqs";

export function AdminSearch({ placeholder }: { placeholder: string }) {
  const [query, setQuery] = useQueryStates(
    { page: parseAsString, search: parseAsString.withDefault("") },
    { limitUrlUpdates: throttle(SEARCH_QUERY_THROTTLE_MS), shallow: false },
  );

  return (
    <div className="relative w-full sm:max-w-md">
      <Search
        aria-hidden="true"
        className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        className="pl-9"
        onChange={(event) => setQuery({ page: null, search: event.target.value })}
        placeholder={placeholder}
        type="search"
        value={query.search}
      />
    </div>
  );
}

export function AdminSearchSkeleton() {
  return <Skeleton className="h-11 w-full rounded-lg sm:max-w-md" />;
}
