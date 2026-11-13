"use client";

import { AdminSmallInput } from "@/components/admin-small-input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { SEARCH_QUERY_THROTTLE_MS } from "@zoonk/utils/search";
import { Search } from "lucide-react";
import { parseAsString, throttle, useQueryStates } from "nuqs";
import { type ComponentProps } from "react";

/** Alone on its row on a phone, the search is a whole field; in the toolbar it takes the toolbar's height. */
function AdminSearchField(props: ComponentProps<"input">) {
  return (
    <AdminSmallInput
      className="md:text-compact pl-9 md:pl-8"
      frameClassName="w-full sm:max-w-md"
      fullOnPhone
      leading={
        <Search
          aria-hidden="true"
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2 md:left-2.5 md:size-3.5"
        />
      }
      type="search"
      {...props}
    />
  );
}

export function AdminSearch({ placeholder }: { placeholder: string }) {
  const [query, setQuery] = useQueryStates(
    { page: parseAsString, search: parseAsString.withDefault("") },
    { limitUrlUpdates: throttle(SEARCH_QUERY_THROTTLE_MS), shallow: false },
  );

  return (
    <AdminSearchField
      onChange={(event) => setQuery({ page: null, search: event.target.value })}
      placeholder={placeholder}
      value={query.search}
    />
  );
}

export function AdminSearchSkeleton() {
  return (
    <div className="flex h-11 w-full items-center sm:max-w-md">
      <Skeleton className="h-11 w-full rounded-lg md:h-7.5 md:rounded-md" />
    </div>
  );
}
