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
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * AI chapter pages can exist before their lesson rows are generated. Showing a
 * normal page-level empty state keeps the chapter URL stable while making the
 * generation step an explicit learner action.
 */
export async function ChapterNotGenerated({
  chapterId,
  courseHref,
}: {
  chapterId: string;
  courseHref: `/b/${string}/c/${string}`;
}) {
  const t = await getExtracted();

  return (
    <Empty className="min-h-80 border-0">
      <EmptyHeader align="start">
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Create this chapter")}</EmptyTitle>

        <EmptyDescription>
          {t(
            "This chapter is part of the course, but it hasn't been created yet. Create it to see all of its lessons.",
          )}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent align="stretch">
        <GenerationShortcutLink
          href={`/generate/ch/${chapterId}`}
          prefetch={false}
          rel="nofollow"
          shortcut="N"
          variant="outline"
        >
          <SparklesIcon data-icon="inline-start" />
          {t("Create chapter")}
        </GenerationShortcutLink>

        <GenerationExitLink href={courseHref} shortcut="Esc">
          {t("Back to course")}
        </GenerationExitLink>
      </EmptyContent>
    </Empty>
  );
}
