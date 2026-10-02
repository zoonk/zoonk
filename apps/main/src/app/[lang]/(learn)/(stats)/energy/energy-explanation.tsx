import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Explains how Energy grows, recovers, and rewards consistent learning. */
export async function EnergyExplanation() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-5 border-t pt-6">
      <Explanation className="gap-1">
        <ExplanationHeader className="text-energy">
          <ZapIcon aria-hidden />
          <ExplanationTitle>{t("How do I increase my Energy?")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t("Complete lessons and answer questions correctly to increase your Energy.")}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("Missed a day?")}</ExplanationTitle>

        <ExplanationText>
          {t("Your Energy drops a little. Complete lessons to fill it back up.")}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("Why is Energy important?")}</ExplanationTitle>

        <ExplanationText>
          {t("Energy rewards consistency. Learning regularly helps reinforce what you learn.")}
        </ExplanationText>
      </Explanation>
    </div>
  );
}

/** Mirrors the three-part explanation without shifting the page as it loads. */
export function EnergyExplanationSkeleton() {
  return (
    <div className="flex flex-col gap-5 border-t pt-6">
      {["increase", "recovery", "importance"].map((section) => (
        <div className="flex flex-col gap-2" key={section}>
          <Skeleton className="h-4 w-36 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
