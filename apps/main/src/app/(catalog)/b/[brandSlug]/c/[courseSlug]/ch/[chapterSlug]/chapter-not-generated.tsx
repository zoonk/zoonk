import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

/**
 * AI chapter pages can exist before their lesson rows are generated. Showing a
 * normal page-level empty state keeps the chapter URL stable while making the
 * generation step an explicit learner action.
 */
export async function ChapterNotGenerated({ chapterId }: { chapterId: string }) {
  const t = await getExtracted();

  return (
    <Empty className="min-h-80 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Chapter not available")}</EmptyTitle>

        <EmptyDescription>{t("This chapter hasn't been created yet.")}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/generate/ch/${chapterId}`}
          prefetch={false}
          rel="nofollow"
        >
          <SparklesIcon data-icon="inline-start" />
          {t("Create chapter")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
