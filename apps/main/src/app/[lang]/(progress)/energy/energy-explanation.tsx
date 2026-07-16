import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function EnergyExplanation() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-5 border-t pt-6">
      <Explanation className="gap-1">
        <ExplanationHeader className="text-energy">
          <ZapIcon aria-hidden />
          <ExplanationTitle>{t("What is Energy?")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t("Energy is a 0% to 100% score for your recent learning consistency and accuracy.")}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("How do I improve Energy?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "Answer questions correctly and keep learning regularly. Correct answers raise Energy; wrong answers and days away from studying lower it.",
          )}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("Why is Energy important?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "Energy is like heart rate in a health app: it shows your current learning rhythm. Missing a day doesn't reset your progress; you recover as soon as you start learning again.",
          )}
        </ExplanationText>
      </Explanation>
    </div>
  );
}
