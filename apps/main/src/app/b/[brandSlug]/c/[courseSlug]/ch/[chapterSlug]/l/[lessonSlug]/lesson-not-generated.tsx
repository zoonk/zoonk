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
  prerequisiteLessonId,
}: {
  lessonId: string;
  brandSlug: string;
  prerequisiteLessonId?: string | null;
}) {
  const t = await getExtracted();
  const canGenerateLesson = brandSlug === AI_ORG_SLUG;
  const generationLessonId = prerequisiteLessonId ?? lessonId;
  const isBlockedByPrerequisite = Boolean(prerequisiteLessonId);

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

      {canGenerateLesson && (
        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/l/${generationLessonId}`}
            prefetch={false}
            rel="nofollow"
          >
            <SparklesIcon data-icon="inline-start" />
            {isBlockedByPrerequisite ? t("Open required lesson") : t("Create lesson")}
          </Link>
        </EmptyContent>
      )}
    </Empty>
  );
}
