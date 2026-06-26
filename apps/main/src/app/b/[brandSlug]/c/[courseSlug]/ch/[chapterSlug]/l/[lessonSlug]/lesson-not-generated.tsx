import { GenerationExitLink } from "@/components/generation/generation-exit-link";
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
  brandSlug,
  chapterSlug,
  courseSlug,
  generationLessonId,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  generationLessonId?: string | null;
}) {
  const t = await getExtracted();
  const canGenerateLesson = brandSlug === AI_ORG_SLUG && Boolean(generationLessonId);
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Create this lesson")}</EmptyTitle>

        <EmptyDescription>
          {t(
            "This lesson is part of the course, but it hasn't been created yet. Create it to start learning.",
          )}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        {canGenerateLesson && generationLessonId && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/l/${generationLessonId}`}
            prefetch={false}
            rel="nofollow"
          >
            <SparklesIcon data-icon="inline-start" />
            {t("Create lesson")}
          </Link>
        )}
        <GenerationExitLink href={chapterHref}>{t("Back to chapter")}</GenerationExitLink>
      </EmptyContent>
    </Empty>
  );
}
