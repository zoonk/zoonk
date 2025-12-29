"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
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
import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toast } from "@zoonk/ui/components/sonner";
import { toSlug } from "@zoonk/utils/string";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import {
  startTransition,
  useActionState,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import {
  ImportCancel,
  ImportDropzone,
  ImportFormatPreview,
  ImportModeOption,
  ImportModeSelector,
  ImportProvider,
  ImportSubmit,
} from "./import";

const MAX_VISIBLE_ITEMS = 10;

const IMPORT_FORMAT = {
  alternativeTitles: ["title-slug-1", "title-slug-2"],
};

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
      return showAll
        ? optimisticTitles
        : optimisticTitles.slice(0, MAX_VISIBLE_ITEMS);
    }

    const searchLower = search.toLowerCase();

    return optimisticTitles.filter((title) =>
      title.toLowerCase().includes(searchLower),
    );
  }, [optimisticTitles, search, showAll]);

  const hasMore =
    !(search.trim() || showAll) && optimisticTitles.length > MAX_VISIBLE_ITEMS;
  const hiddenCount = optimisticTitles.length - MAX_VISIBLE_ITEMS;

  async function handleAdd(
    _state: { error: string | null },
    formData: FormData,
  ) {
    const title = formData.get("title") as string;

    if (!title?.trim()) {
      return { error: null };
    }

    const slug = toSlug(title);

    startTransition(() => {
      updateOptimisticTitles((prev) =>
        prev.includes(slug) ? prev : [...prev, slug].sort(),
      );
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
      <Collapsible className="px-4" onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 py-2 text-muted-foreground text-sm hover:text-foreground">
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

            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={exportPending}
                render={<Button size="icon-sm" variant="ghost" />}
              >
                <EllipsisVerticalIcon />
                <span className="sr-only">{t("More options")}</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <UploadIcon />
                  {t("Import")}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleExport}>
                  <DownloadIcon />
                  {t("Export")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </form>

          {addState.error && (
            <p className="text-destructive text-sm">{addState.error}</p>
          )}

          {optimisticTitles.length > 0 && (
            <>
              <div className="relative">
                <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-9 text-sm"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search titles…")}
                  value={search}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredTitles.map((slug) => (
                  <Badge
                    className="gap-1 pr-1 font-normal"
                    key={slug}
                    variant="outline"
                  >
                    {slug}
                    <button
                      aria-label={t("Remove {title}", { title: slug })}
                      className="rounded-full p-0.5 hover:bg-muted"
                      onClick={() => handleDelete(slug)}
                      type="button"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {hasMore && (
                <button
                  className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                  onClick={() => setShowAll(true)}
                  type="button"
                >
                  {t("and {count} more", { count: String(hiddenCount) })}
                </button>
              )}

              {showAll && !search.trim() && hiddenCount > 0 && (
                <button
                  className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                  onClick={() => setShowAll(false)}
                  type="button"
                >
                  {t("Show less")}
                </button>
              )}

              {search && filteredTitles.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("No titles match your search")}
                </p>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <ImportProvider onImport={onImport} onSuccess={handleImportSuccess}>
        <Dialog onOpenChange={setImportOpen} open={importOpen}>
          <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("Import alternative titles")}</DialogTitle>
              <DialogDescription>
                {t(
                  "Upload a JSON file containing alternative titles to import.",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-w-0 gap-6">
              <ImportDropzone>
                {t("Drop file or click to select")}
              </ImportDropzone>

              <ImportModeSelector label={t("Import mode")}>
                <ImportModeOption value="merge">
                  {t("Merge (add to existing)")}
                </ImportModeOption>
                <ImportModeOption value="replace">
                  {t("Replace (remove existing first)")}
                </ImportModeOption>
              </ImportModeSelector>

              <ImportFormatPreview
                format={IMPORT_FORMAT}
                label={t("Show expected format")}
              />
            </div>

            <DialogFooter>
              <ImportCancel onClick={() => setImportOpen(false)}>
                {t("Cancel")}
              </ImportCancel>
              <ImportSubmit>{t("Import")}</ImportSubmit>
            </DialogFooter>
          </DialogContent>
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
