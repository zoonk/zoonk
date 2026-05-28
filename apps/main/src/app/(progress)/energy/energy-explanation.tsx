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

      <ExplanationText>
        {t("Energy is a score from 0% to 100%. The goal is to keep it near 100%.")}
      </ExplanationText>

      <ExplanationText>
        {t(
          "It goes up when you answer correctly and goes down when you answer incorrectly or go a day without studying.",
        )}
      </ExplanationText>

      <ExplanationText>
        {t(
          "It is not a streak. Missing a day does not reset Energy to zero. It drops a little, and you can recover it when you return.",
        )}
      </ExplanationText>
    </Explanation>
  );
}
