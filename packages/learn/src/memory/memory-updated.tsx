"use client";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryFactView,
} from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

type UndoStatus = "failed" | "idle" | "undone";

type MemoryFactSummary = Pick<MemoryFactView, "id" | "statement">;

type MemoryChangeSummary = Pick<MemoryChange, "action"> & {
  fact: MemoryFactSummary | null;
  previous: MemoryFactSummary | null;
};

function toMemoryChangeReferences(changes: MemoryChangeSummary[]): MemoryChangeReference[] {
  return changes.map((change) => ({
    factId: change.fact?.id ?? null,
    previousFactId: change.previous?.id ?? null,
  }));
}

function ChangeText({ change, extra }: { change: MemoryChangeSummary; extra: number }) {
  const t = useExtracted();

  return (
    <>
      <span className="text-foreground font-medium">{t("Memory updated:")}</span>{" "}
      {change.fact && <span>{change.fact.statement}</span>}{" "}
      {change.previous && <del>{change.previous.statement}</del>}
      {extra > 0 && (
        <span> {t("{count, plural, one {and # more} other {and # more}}", { count: extra })}</span>
      )}
    </>
  );
}

function UndoResult({ status }: { status: UndoStatus }) {
  const t = useExtracted();

  if (status === "undone") {
    return <span>{t("Change undone")}</span>;
  }

  return <span className="text-destructive-text">{t("Couldn't undo. It changed since.")}</span>;
}

/** `onUndo` resolves to whether the changes were undone. */
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
        "text-muted-foreground flex items-start gap-2 text-[0.8125rem] leading-5",
        className,
      )}
      data-slot="memory-updated"
      role="status"
    >
      <BrainIcon aria-hidden="true" className="mt-0.75 size-3.5 shrink-0" />

      <p className="min-w-0 flex-1 text-pretty">
        {status === "idle" ? (
          <>
            <ChangeText change={first} extra={changes.length - 1} />
            <span aria-hidden="true">{" · "}</span>
            <Button disabled={isPending} onClick={undo} variant="link">
              {t("Undo")}
            </Button>
          </>
        ) : (
          <UndoResult status={status} />
        )}
      </p>
    </div>
  );
}
