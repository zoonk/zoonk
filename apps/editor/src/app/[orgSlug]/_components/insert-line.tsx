"use client";

import { PlusIcon } from "lucide-react";

export function InsertLine({
  onInsert,
  pending,
}: {
  onInsert: () => void;
  pending?: boolean;
}) {
  return (
    <div className="group relative h-0">
      <div className="absolute inset-x-4 -top-px z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="h-px flex-1 bg-primary/30" />

        <button
          className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={pending}
          onClick={onInsert}
          type="button"
        >
          <PlusIcon className="size-3" />
        </button>

        <div className="h-px flex-1 bg-primary/30" />
      </div>
    </div>
  );
}
