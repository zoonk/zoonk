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
  lessonId,
  prerequisiteLessonId,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonId: string;
  prerequisiteLessonId?: string | null;
}) {
  const t = await getExtracted();
  const canGenerateLesson = brandSlug === AI_ORG_SLUG;
  const generationLessonId = prerequisiteLessonId ?? lessonId;
  const isBlockedByPrerequisite = Boolean(prerequisiteLessonId);
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>
          {isBlockedByPrerequisite ? t("Lesson locked") : t("Lesson not available")}
        </EmptyTitle>

        <EmptyDescription>
          {isBlockedByPrerequisite
            ? t("Create the required lesson first.")
            : t("This lesson hasn't been created yet.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        {canGenerateLesson && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/l/${generationLessonId}`}
            prefetch={false}
            rel="nofollow"
          >
            <SparklesIcon data-icon="inline-start" />
            {isBlockedByPrerequisite ? t("Open required lesson") : t("Create lesson")}
          </Link>
        )}
        <GenerationExitLink href={chapterHref}>{t("Back to chapter")}</GenerationExitLink>
      </EmptyContent>
    </Empty>
  );
}
