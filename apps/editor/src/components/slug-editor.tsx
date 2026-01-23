"use client";

import { useSlugCheck } from "@/lib/use-slug-check";
import { Button } from "@zoonk/ui/components/button";
import { EditableLabel, EditableText } from "@zoonk/ui/components/editable-text";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toast } from "@zoonk/ui/components/sonner";
import { Check, CircleAlert, Link as LinkIcon, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SlugEditorSkeleton() {
  return <Skeleton className="mx-4 h-5 w-32" />;
}

type SlugCheckParams = {
  chapterId?: number;
  courseId?: number;
  language: string;
  orgSlug: string;
  slug: string;
};

type SlugEditorProps = {
  chapterId?: number;
  checkFn: (params: SlugCheckParams) => Promise<boolean>;
  courseId?: number;
  entityId: number;
  initialSlug: string;
  language: string;
  onSave: (
    id: number,
    data: { slug: string },
  ) => Promise<{ error: string | null; newSlug?: string }>;
  orgSlug: string;
  redirectPrefix: string;
  redirectSuffix?: string;
};

export function SlugEditor({
  chapterId,
  checkFn,
  courseId,
  entityId,
  initialSlug,
  language,
  onSave,
  orgSlug,
  redirectPrefix,
  redirectSuffix = "",
}: SlugEditorProps) {
  const t = useExtracted();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slug, setSlug] = useState(initialSlug);

  const slugExists = useSlugCheck({
    chapterId,
    checkFn,
    courseId,
    initialSlug,
    language,
    orgSlug,
    slug,
  });

  const hasChanged = slug.trim() !== initialSlug;
  const isEmpty = slug.trim().length === 0;
  const showError = hasChanged && slugExists;
  const canSave = hasChanged && !isEmpty && !slugExists && !isPending;

  function handleCancel() {
    setSlug(initialSlug);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await onSave(entityId, { slug: slug.trim() });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.newSlug) {
        const url = `${redirectPrefix}${result.newSlug}${redirectSuffix}`;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dynamic internal routes require assertion
        router.push(url as never);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && canSave) {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <EditableLabel htmlFor="slug-editor" icon={LinkIcon}>
        {t("URL address")}
      </EditableLabel>

      <div className="flex h-5 items-center gap-2">
        <EditableText
          className="max-w-48 text-sm"
          disabled={isPending}
          id="slug-editor"
          onChange={(event) => setSlug(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("your-custom-url")}
          value={slug}
          variant="muted"
        />

        <div
          className={`flex items-center gap-1 transition-opacity ${hasChanged ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {showError ? (
            <span
              aria-label={t("This URL is already in use")}
              className="flex size-5 items-center justify-center"
              role="img"
            >
              <CircleAlert className="text-destructive size-4" />
            </span>
          ) : (
            <Button
              aria-label={t("Save")}
              disabled={!canSave}
              onClick={handleSave}
              size="icon-sm"
              variant="ghost"
            >
              <Check className="size-4" />
            </Button>
          )}

          <Button
            aria-label={t("Cancel")}
            disabled={isPending}
            onClick={handleCancel}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {showError && <p className="text-destructive text-xs">{t("This URL is already in use")}</p>}
    </div>
  );
}
