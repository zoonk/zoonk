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
        <ExplanationTitle>{t("About Energy Level")}</ExplanationTitle>
      </ExplanationHeader>

      <ExplanationText className="leading-relaxed">
        {t(
          "Energy reflects your learning consistency. It increases with correct answers (+0.1%), decreases with wrong answers (-0.03%), and drops 1% for each inactive day.",
        )}
      </ExplanationText>
    </Explanation>
  );
}
