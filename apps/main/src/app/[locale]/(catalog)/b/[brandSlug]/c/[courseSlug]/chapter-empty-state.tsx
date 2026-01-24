"use client";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type ChapterEmptyStateProps = {
  chapterId: number;
};

export function ChapterEmptyState({ chapterId }: ChapterEmptyStateProps) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("Lessons haven't been generated for this chapter yet.")}
      </p>
      <Link
        className={buttonVariants({
          className: "w-fit",
          size: "sm",
          variant: "outline",
        })}
        href={`/generate/ch/${chapterId}`}
        prefetch={false}
      >
        <SparklesIcon className="size-4" />
        {t("Generate lessons")}
      </Link>
    </div>
  );
}
