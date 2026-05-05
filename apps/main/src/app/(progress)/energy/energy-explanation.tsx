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
    <Explanation className="gap-1 border-t pt-6">
      <ExplanationHeader className="text-energy">
        <ZapIcon aria-hidden />
        <ExplanationTitle>{t("About Energy")}</ExplanationTitle>
      </ExplanationHeader>

      <ExplanationText className="leading-relaxed">
        {t(
          "Energy reflects your learning consistency. It increases with correct answers, decreases with wrong answers, and drops for each inactive day.",
        )}
      </ExplanationText>
    </Explanation>
  );
}
