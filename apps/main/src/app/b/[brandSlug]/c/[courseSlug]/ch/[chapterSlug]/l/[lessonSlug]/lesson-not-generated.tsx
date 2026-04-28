import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function LessonNotGenerated({
  lessonId,
  brandSlug,
}: {
  lessonId: string;
  brandSlug: string;
}) {
  const t = await getExtracted();
  const canGenerateLesson = brandSlug === AI_ORG_SLUG;

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Lesson not available")}</EmptyTitle>

        <EmptyDescription>{t("This lesson hasn't been created yet.")}</EmptyDescription>
      </EmptyHeader>

      {canGenerateLesson && (
        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/l/${lessonId}`}
            prefetch={false}
            rel="nofollow"
          >
            <SparklesIcon data-icon="inline-start" />
            {t("Create lesson")}
          </Link>
        </EmptyContent>
      )}
    </Empty>
  );
}
