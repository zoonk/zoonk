"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { toast } from "@zoonk/ui/components/sonner";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Trash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

async function noop() {
  return { error: null };
}

export function DeleteItemButton({
  title,
  description,
  srLabel,
  onDelete = noop,
}: {
  title?: string;
  description?: string;
  srLabel?: string;
  onDelete?: () => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const resolvedTitle = title ?? t("Delete item?");
  const resolvedDescription = description ?? t("This action cannot be undone.");
  const resolvedSrLabel = srLabel ?? t("Delete item");

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete();

      if (result.error) {
        toast.error(result.error);
        setIsOpen(false);
      }
    });
  }

  return (
    <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
      <AlertDialogTrigger
        disabled={isPending}
        render={<Button size="icon-sm" variant="ghost" />}
      >
        {isPending ? (
          <Spinner />
        ) : (
          <Trash2Icon className="text-muted-foreground" />
        )}
        <span className="sr-only">{resolvedSrLabel}</span>
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>

          <AlertDialogDescription>{resolvedDescription}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("Cancel")}
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {isPending ? <Spinner /> : t("Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
