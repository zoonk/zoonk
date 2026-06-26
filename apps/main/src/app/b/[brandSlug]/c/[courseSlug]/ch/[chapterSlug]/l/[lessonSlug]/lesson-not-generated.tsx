import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
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
      <EmptyHeader align="start">
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

      <EmptyContent align="stretch">
        {canGenerateLesson && generationLessonId && (
          <GenerationShortcutLink
            href={`/generate/l/${generationLessonId}`}
            prefetch={false}
            rel="nofollow"
            shortcut="N"
            variant="outline"
          >
            <SparklesIcon data-icon="inline-start" />
            {t("Create lesson")}
          </GenerationShortcutLink>
        )}
        <GenerationExitLink href={chapterHref} shortcut="Esc">
          {t("Back to chapter")}
        </GenerationExitLink>
      </EmptyContent>
    </Empty>
  );
}
