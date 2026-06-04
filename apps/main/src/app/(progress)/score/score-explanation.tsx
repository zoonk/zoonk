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
    <div className="flex flex-col gap-5 border-t pt-6">
      <Explanation className="gap-1">
        <ExplanationHeader className="text-score">
          <Target aria-hidden />
          <ExplanationTitle>{t("What is Score?")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t("Score is the percentage of questions you answered correctly during this period.")}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("How do I improve Score?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "Review mistakes and retry lessons. As you answer more questions correctly, your Score goes up.",
          )}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("Why is Score important?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "Score shows accuracy, not activity. Best day and best time help you find when you learn most effectively.",
          )}
        </ExplanationText>
      </Explanation>
    </div>
  );
}
