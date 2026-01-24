"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { Dialog } from "@zoonk/ui/components/dialog";
import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toast } from "@zoonk/ui/components/sonner";
import { toSlug } from "@zoonk/utils/string";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  startTransition,
  useActionState,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { ImportProvider } from "../import";
import { AlternativeTitleBadge } from "./alternative-title-badge";
import { AlternativeTitlesFormActions } from "./alternative-titles-form-actions";
import { AlternativeTitlesImportDialog } from "./alternative-titles-import-dialog";

const MAX_VISIBLE_ITEMS = 10;

export function AlternativeTitlesEditor({
  titles,
  onAdd,
  onDelete,
  onExport,
  onImport,
}: {
  titles: string[];
  onAdd: (title: string) => Promise<{ error: string | null }>;
  onDelete: (slug: string) => Promise<{ error: string | null }>;
  onExport: () => Promise<{ data: object | null; error: Error | null }>;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [exportPending, startExportTransition] = useTransition();
  const [optimisticTitles, updateOptimisticTitles] = useOptimistic(titles);

  function handleExport() {
    startExportTransition(async () => {
      const { data, error } = await onExport();

      if (error || !data) {
        toast.error(error?.message ?? t("Failed to export"));
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "alternative-titles.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t("Alternative titles exported successfully"));
    });
  }

  function handleImportSuccess() {
    toast.success(t("Alternative titles imported successfully"));
    setImportOpen(false);
  }

  const filteredTitles = useMemo(() => {
    if (!search.trim()) {
      return showAll ? optimisticTitles : optimisticTitles.slice(0, MAX_VISIBLE_ITEMS);
    }

    const searchLower = search.toLowerCase();

    return optimisticTitles.filter((title) => title.toLowerCase().includes(searchLower));
  }, [optimisticTitles, search, showAll]);

  const hasMore = !(search.trim() || showAll) && optimisticTitles.length > MAX_VISIBLE_ITEMS;
  const hiddenCount = optimisticTitles.length - MAX_VISIBLE_ITEMS;

  async function handleAdd(_state: { error: string | null }, formData: FormData) {
    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" ? titleValue : "";

    if (!title.trim()) {
      return { error: null };
    }

    const slug = toSlug(title);

    startTransition(() => {
      updateOptimisticTitles((prev) => (prev.includes(slug) ? prev : [...prev, slug].toSorted()));
    });

    const result = await onAdd(title);

    return result;
  }

  async function handleDelete(slug: string) {
    startTransition(() => {
      updateOptimisticTitles((prev) => prev.filter((item) => item !== slug));
    });

    await onDelete(slug);
  }

  const [addState, addAction, isAdding] = useActionState(handleAdd, {
    error: null,
  });

  return (
    <>
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-2 text-sm">
          {isOpen ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          )}
          <span>{t("Alternative titles")}</span>
          {optimisticTitles.length > 0 && (
            <span className="text-muted-foreground/60">
              {t("({count})", { count: String(optimisticTitles.length) })}
            </span>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pb-4">
          <form action={addAction} className="flex gap-2">
            <Input
              className="h-8 text-sm"
              disabled={isAdding}
              key={isAdding ? "adding" : "idle"}
              name="title"
              placeholder={t("Add alternative title…")}
            />
            <Button disabled={isAdding} size="sm" type="submit">
              {t("Add")}
            </Button>

            <AlternativeTitlesFormActions
              disabled={exportPending}
              onExport={handleExport}
              onImport={() => setImportOpen(true)}
            />
          </form>

          {addState.error && <p className="text-destructive text-sm">{addState.error}</p>}

          {optimisticTitles.length > 0 && (
            <>
              <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="h-8 pl-9 text-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search titles…")}
                  value={search}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredTitles.map((slug) => (
                  <AlternativeTitleBadge key={slug} onDelete={handleDelete} slug={slug} />
                ))}
              </div>

              {hasMore && (
                <button
                  className="text-muted-foreground hover:text-foreground text-xs hover:underline"
                  onClick={() => setShowAll(true)}
                  type="button"
                >
                  {t("and {count} more", { count: String(hiddenCount) })}
                </button>
              )}

              {showAll && !search.trim() && hiddenCount > 0 && (
                <button
                  className="text-muted-foreground hover:text-foreground text-xs hover:underline"
                  onClick={() => setShowAll(false)}
                  type="button"
                >
                  {t("Show less")}
                </button>
              )}

              {search && filteredTitles.length === 0 && (
                <p className="text-muted-foreground text-sm">{t("No titles match your search")}</p>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <ImportProvider onImport={onImport} onSuccess={handleImportSuccess}>
        <Dialog onOpenChange={setImportOpen} open={importOpen}>
          <AlternativeTitlesImportDialog onClose={() => setImportOpen(false)} />
        </Dialog>
      </ImportProvider>
    </>
  );
}

export function AlternativeTitlesSkeleton() {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <Skeleton className="size-4" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
