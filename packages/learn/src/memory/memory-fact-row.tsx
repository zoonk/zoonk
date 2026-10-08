"use client";

import { type MemoryFactView } from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Textarea } from "@zoonk/ui/components/textarea";
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MemoryFactSource } from "./memory-labels";

/**
 * Core's limit for one fact (`MAX_MEMORY_STATEMENT_LENGTH`). The contract module loads the database
 * enums, which can't ship to the browser, so the field repeats it and the server still checks.
 */
const MAX_STATEMENT_LENGTH = 160;

function EditFactDialog({
  fact,
  onClose,
  onSave,
}: {
  fact: MemoryFactView;
  onClose: () => void;
  onSave: (statement: string) => void;
}) {
  const t = useExtracted();
  const statementId = useId();
  const [statement, setStatement] = useState(fact.statement);
  const trimmed = statement.trim();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent closeLabel={t("Close")}>
        <DialogHeader>
          <DialogTitle>{t("Edit memory")}</DialogTitle>
          <DialogDescription>{t("Say it the way it's true for you.")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(trimmed);
          }}
        >
          <label className="sr-only" htmlFor={statementId}>
            {t("What Zoonk remembers")}
          </label>
          <Textarea
            id={statementId}
            maxLength={MAX_STATEMENT_LENGTH}
            onChange={(event) => setStatement(event.target.value)}
            value={statement}
          />

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              {t("Cancel")}
            </Button>
            <Button disabled={!trimmed || trimmed === fact.statement} type="submit">
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One fact, where it came from, and a menu to correct or delete it. */
export function MemoryFactRow({
  fact,
  onDelete,
  onEdit,
}: {
  fact: MemoryFactView;
  onDelete: () => void;
  onEdit: (statement: string) => void;
}) {
  const t = useExtracted();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <li className="flex items-start gap-3 px-4 py-3.5" data-slot="memory-fact">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-base leading-snug">{fact.statement}</p>
        <p className="text-muted-foreground text-xs">
          <MemoryFactSource fact={fact} />
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("Options for “{fact}”", { fact: fact.statement })}
              className="text-muted-foreground -my-2.75 -mr-2 size-11 shrink-0"
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <PencilIcon aria-hidden="true" />
            {t("Edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <Trash2Icon aria-hidden="true" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isEditing && (
        <EditFactDialog
          fact={fact}
          onClose={() => setIsEditing(false)}
          onSave={(statement) => {
            setIsEditing(false);
            onEdit(statement);
          }}
        />
      )}
    </li>
  );
}
