import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
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
      <EmptyHeader align="start">
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
        <EmptyContent align="stretch">
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
        </EmptyContent>
      )}
    </Empty>
  );
}
