import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { BrainIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Explains only the action and durable outcome a learner needs to understand levels. */
export async function LevelExplanation() {
  const t = await getExtracted();

  return (
    <div className="border-t pt-6">
      <Explanation>
        <ExplanationHeader>
          <BrainIcon aria-hidden />
          <ExplanationTitle>{t("How levels work")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t(
            "Complete lessons to earn {brainPower} BP. Brain Power never goes down, so every lesson moves you closer to the next level.",
            { brainPower: String(BRAIN_POWER_PER_LESSON) },
          )}
        </ExplanationText>
      </Explanation>
    </div>
  );
}

/** Preserves the explanation's final footprint while its copy is loading. */
export function LevelExplanationSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-t pt-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
