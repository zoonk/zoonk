import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { Target } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function ScoreExplanation() {
  const t = await getExtracted();

  return (
    <Explanation className="gap-1 border-t pt-6">
      <ExplanationHeader className="text-score">
        <Target aria-hidden />
        <ExplanationTitle>{t("About Score")}</ExplanationTitle>
      </ExplanationHeader>

      <ExplanationText className="leading-relaxed">
        {t(
          "Your score shows the percentage of questions you answered correctly. It helps you track your accuracy over time and identify your best days and times for learning.",
        )}
      </ExplanationText>
    </Explanation>
  );
}
