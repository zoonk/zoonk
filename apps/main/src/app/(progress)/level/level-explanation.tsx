import {
  Explanation,
  ExplanationHeader,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { BrainIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function LevelExplanation() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-5 border-t pt-6">
      <Explanation className="gap-1">
        <ExplanationHeader className="text-score">
          <BrainIcon aria-hidden />
          <ExplanationTitle>{t("What is Brain Power?")}</ExplanationTitle>
        </ExplanationHeader>

        <ExplanationText>
          {t(
            "Brain Power (BP) is the total learning credit you have earned. Each completed lesson adds {brainPower} BP.",
            { brainPower: String(BRAIN_POWER_PER_LESSON) },
          )}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("How do I increase Brain Power?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "Complete lessons. Brain Power never goes down, even when your Energy drops or you take a break.",
          )}
        </ExplanationText>
      </Explanation>

      <Explanation className="gap-1">
        <ExplanationTitle>{t("Why is Brain Power important?")}</ExplanationTitle>

        <ExplanationText>
          {t(
            "It is like steps in a health app: a record of how much you have learned. It also works like martial arts for your mind: build Brain Power to advance from white belt to black belt.",
          )}
        </ExplanationText>
      </Explanation>
    </div>
  );
}
