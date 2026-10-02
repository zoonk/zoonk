"use client";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryFactView,
} from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

type UndoStatus = "failed" | "idle" | "undone";

type MemoryFactSummary = Pick<MemoryFactView, "id" | "statement">;

/** What the notice reads of a change, so a chat's streamed changes show it as well as the API's. */
type MemoryChangeSummary = Pick<MemoryChange, "action"> & {
  fact: MemoryFactSummary | null;
  previous: MemoryFactSummary | null;
};

/** What an undo sends back: the fact each change added and the one it replaced or removed. */
function toMemoryChangeReferences(changes: MemoryChangeSummary[]): MemoryChangeReference[] {
  return changes.map((change) => ({
    factId: change.fact?.id ?? null,
    previousFactId: change.previous?.id ?? null,
  }));
}

function ChangeText({ change, extra }: { change: MemoryChangeSummary; extra: number }) {
  const t = useExtracted();

  return (
    <span className="min-w-0 flex-1">
      <span className="font-medium">{t("Memory updated:")}</span>{" "}
      {change.fact && <span>{change.fact.statement}</span>}{" "}
      {change.previous && <del className="text-muted-foreground">{change.previous.statement}</del>}
      {extra > 0 && (
        <span className="text-muted-foreground">
          {" "}
          {t("{count, plural, one {and # more} other {and # more}}", { count: extra })}
        </span>
      )}
    </span>
  );
}

function UndoResult({ status }: { status: UndoStatus }) {
  const t = useExtracted();

  if (status === "undone") {
    return <span className="text-muted-foreground">{t("Change undone")}</span>;
  }

  return <span className="text-destructive">{t("Couldn't undo. It changed since.")}</span>;
}

/**
 * "Memory updated", with what changed and an undo, shown right where a chat, a session or the
 * Memory screen changed what Zoonk remembers. `onUndo` sends the changes back and says whether
 * they were undone.
 */
export function MemoryUpdated({
  changes,
  className,
  onUndo,
}: {
  changes: MemoryChangeSummary[];
  className?: string;
  onUndo: (changes: MemoryChangeReference[]) => Promise<boolean>;
}) {
  const t = useExtracted();
  const [status, setStatus] = useState<UndoStatus>("idle");
  const [isPending, startTransition] = useTransition();
  const [first] = changes;

  if (!first) {
    return null;
  }

  const undo = () => {
    startTransition(async () => {
      setStatus((await onUndo(toMemoryChangeReferences(changes))) ? "undone" : "failed");
    });
  };

  return (
    <div
      aria-live="polite"
      className={cn(
        "border-border bg-background in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl border px-3 py-3.5 text-sm",
        className,
      )}
      data-slot="memory-updated"
      role="status"
    >
      <LineMarker aria-hidden="true">
        <BrainIcon className="in-data-[mode=fun]:text-fun-accent-violet size-4 text-violet-600 dark:text-violet-400" />
      </LineMarker>

      {status === "idle" ? (
        <ChangeText change={first} extra={changes.length - 1} />
      ) : (
        <span className="min-w-0 flex-1">
          <UndoResult status={status} />
        </span>
      )}

      {status === "idle" && (
        <Button
          className="-my-1.5 shrink-0"
          disabled={isPending}
          onClick={undo}
          size="sm"
          variant="ghost"
        >
          {t("Undo")}
        </Button>
      )}
    </div>
  );
}
