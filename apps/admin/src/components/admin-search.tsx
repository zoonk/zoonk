"use client";

import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { SEARCH_QUERY_THROTTLE_MS } from "@zoonk/utils/search";
import { Search } from "lucide-react";
import { throttle, useQueryState } from "nuqs";

export function AdminSearch({ placeholder }: { placeholder: string }) {
  const [search, setSearch] = useQueryState("search", {
    defaultValue: "",
    limitUrlUpdates: throttle(SEARCH_QUERY_THROTTLE_MS),
    shallow: false,
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

export function AdminSearchSkeleton() {
  return <Skeleton className="h-10 w-full" />;
}
