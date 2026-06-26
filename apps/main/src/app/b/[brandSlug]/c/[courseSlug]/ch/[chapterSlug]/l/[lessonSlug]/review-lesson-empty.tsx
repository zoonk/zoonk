import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { BookOpenCheckIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

/**
 * Replaces the misleading zero-step completion screen for review lessons with
 * a concrete next action when earlier generated lessons still need content.
 */
export async function ReviewLessonEmpty({
  generationLessonId,
}: {
  generationLessonId: string | null;
}) {
  const t = await getExtracted();
  const isWaitingForGeneration = Boolean(generationLessonId);

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpenCheckIcon />
        </EmptyMedia>

        <EmptyTitle>
          {isWaitingForGeneration
            ? t("Create lessons before reviewing")
            : t("Nothing to review yet")}
        </EmptyTitle>

        <EmptyDescription>
          {isWaitingForGeneration
            ? t("Review unlocks after the earlier lessons in this chapter have been created.")
            : t("There are no practice questions to review yet.")}
        </EmptyDescription>
      </EmptyHeader>

      {generationLessonId && (
        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/l/${generationLessonId}`}
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
