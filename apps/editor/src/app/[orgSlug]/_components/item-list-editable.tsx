"use client";

import { Button } from "@zoonk/ui/components/button";
import { toast } from "@zoonk/ui/components/sonner";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTransition } from "react";
import { InsertLine } from "./insert-line";
import { ItemActionsMenu } from "./item-actions-menu";

type ItemListItem = {
  slug: string;
  title: string;
  description: string;
  position: number;
};

type ItemListEditableProps = {
  addLabel: string;
  cancelLabel?: string;
  dropLabel?: string;
  entityType?: "chapters" | "lessons";
  exportErrorMessage?: string;
  exportLabel?: string;
  exportSuccessMessage?: string;
  fileSizeUnit?: string;
  hrefPrefix: string;
  importDescription?: string;
  importLabel?: string;
  importSuccessMessage?: string;
  importTitle?: string;
  items: ItemListItem[];
  modeLabel?: string;
  modeMergeLabel?: string;
  modeReplaceLabel?: string;
  moreOptionsLabel?: string;
  onExport?: () => Promise<{ data: object | null; error: Error | null }>;
  onImport?: (formData: FormData) => Promise<{ error: string | null }>;
  onInsert: (position: number) => Promise<void>;
  showFormatLabel?: string;
};

export function ItemListEditable({
  addLabel,
  cancelLabel,
  dropLabel,
  entityType,
  exportErrorMessage,
  exportLabel,
  exportSuccessMessage,
  fileSizeUnit,
  hrefPrefix,
  importDescription,
  importLabel,
  importSuccessMessage,
  importTitle,
  items,
  modeLabel,
  modeMergeLabel,
  modeReplaceLabel,
  moreOptionsLabel,
  onExport,
  onImport,
  onInsert,
  showFormatLabel,
}: ItemListEditableProps) {
  const [pending, startTransition] = useTransition();

  function handleInsert(position: number) {
    startTransition(async () => {
      try {
        await onInsert(position);
      } catch (error) {
        console.error(`Failed to insert item at position ${position}:`, error);
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  }

  const lastItem = items.at(-1);
  const endPosition = lastItem ? lastItem.position + 1 : 0;

  return (
    <div className="relative">
      {pending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-4 pb-2">
        <Button
          disabled={pending}
          onClick={() => handleInsert(endPosition)}
          size="sm"
          variant="outline"
        >
          <PlusIcon />
          {addLabel}
        </Button>

        {entityType &&
          cancelLabel &&
          dropLabel &&
          exportErrorMessage &&
          exportLabel &&
          exportSuccessMessage &&
          fileSizeUnit &&
          importDescription &&
          importLabel &&
          importSuccessMessage &&
          importTitle &&
          modeLabel &&
          modeMergeLabel &&
          modeReplaceLabel &&
          moreOptionsLabel &&
          showFormatLabel &&
          onExport &&
          onImport && (
            <ItemActionsMenu
              cancelLabel={cancelLabel}
              dropLabel={dropLabel}
              entityType={entityType}
              exportErrorMessage={exportErrorMessage}
              exportLabel={exportLabel}
              exportSuccessMessage={exportSuccessMessage}
              fileSizeUnit={fileSizeUnit}
              importDescription={importDescription}
              importLabel={importLabel}
              importSuccessMessage={importSuccessMessage}
              importTitle={importTitle}
              modeLabel={modeLabel}
              modeMergeLabel={modeMergeLabel}
              modeReplaceLabel={modeReplaceLabel}
              moreOptionsLabel={moreOptionsLabel}
              onExport={onExport}
              onImport={onImport}
              showFormatLabel={showFormatLabel}
            />
          )}
      </div>

      {items.length > 0 && (
        <ul>
          <InsertLine onInsert={() => handleInsert(0)} pending={pending} />

          {items.map((item) => (
            <li key={item.slug}>
              <Link
                className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                href={`${hrefPrefix}${item.slug}` as Route}
              >
                <span className="mt-0.5 font-mono text-muted-foreground text-sm tabular-nums">
                  {String(item.position).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>

                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  )}
                </div>
              </Link>

              <InsertLine
                onInsert={() => handleInsert(item.position + 1)}
                pending={pending}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
