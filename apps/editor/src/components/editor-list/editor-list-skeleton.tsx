"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";

const DEFAULT_SKELETON_COUNT = 3;

export function EditorListSkeleton({ count = DEFAULT_SKELETON_COUNT }: { count?: number }) {
  return (
    <div data-slot="editor-list">
      <div className="flex items-center justify-end gap-2 px-4 pb-2">
        <Skeleton className="h-8 w-28" />
      </div>

      <ul>
        {Array.from({ length: count }).map((_, i) => (
          <li className="border-border flex items-center gap-2 border-t px-4 py-3" key={i}>
            <Skeleton className="size-4" />

            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Skeleton className="mt-0.5 h-5 w-6" />

              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
