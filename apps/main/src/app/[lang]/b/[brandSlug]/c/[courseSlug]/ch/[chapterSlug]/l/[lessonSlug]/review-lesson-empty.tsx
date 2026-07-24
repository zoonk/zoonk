import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
import { Empty, EmptyContent } from "@zoonk/ui/components/empty";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { LessonSummaryStatus } from "./lesson-summary";

/**
 * Replaces the misleading zero-step completion screen for review lessons with
 * a concrete next action when earlier generated lessons still need content.
 */
export async function ReviewLessonEmpty({
  children,
  generationLessonId,
}: {
  children: React.ReactNode;
  generationLessonId: string | null;
}) {
  const t = await getExtracted();
  const isWaitingForGeneration = Boolean(generationLessonId);

  return (
    <Empty className="border-0">
      {children}

      <EmptyContent align="stretch">
        <LessonSummaryStatus>
          {isWaitingForGeneration
            ? t("Review unlocks after the earlier lessons in this chapter have been created.")
            : t("There are no practice questions to review yet.")}
        </LessonSummaryStatus>

        {generationLessonId && (
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
      </EmptyContent>
    </Empty>
  );
}
