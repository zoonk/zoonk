import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Target } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * Defines Score once and explains why harder work can lower it temporarily,
 * giving learners essential context without restoring a multi-section FAQ.
 */
export async function ScoreExplanation() {
  const t = await getExtracted();

  return (
    <div className="border-t pt-6">
      <Explanation className="gap-1">
        <ExplanationHeader className="text-score">
          <Target aria-hidden />
          <ExplanationTitle>{t("What is Score?")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t(
            "Score is the percentage of questions you answered correctly over the past 90 days. Every answer counts equally, so harder lessons can lower your Score for a while. That’s part of learning.",
          )}
        </ExplanationText>
      </Explanation>
    </div>
  );
}

/** Mirrors the one concise Score definition while translated copy streams. */
export function ScoreExplanationSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 border-t pt-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
