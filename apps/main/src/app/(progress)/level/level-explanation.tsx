import { Explanation, ExplanationText, ExplanationTitle } from "@zoonk/ui/components/explanation";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { getExtracted } from "next-intl/server";

export async function LevelExplanation() {
  const t = await getExtracted();

  return (
    <Explanation className="gap-1 border-t pt-6">
      <ExplanationTitle>{t("About Brain Power")}</ExplanationTitle>

      <ExplanationText>
        {t(
          "Brain Power (BP) represents how much you have learned. You earn {brainPower} BP after each lesson you complete. It never goes down because knowledge is not something anyone can take from you.",
          { brainPower: String(BRAIN_POWER_PER_LESSON) },
        )}
      </ExplanationText>

      <ExplanationText>
        {t(
          "The more Brain Power you have, the more knowledge you have built. You do not lose Brain Power when your Energy drops or when you miss days.",
        )}
      </ExplanationText>

      <ExplanationText>
        {t(
          "Brain Power is like martial arts for your mind: the more you study, the stronger it gets. You start as a white belt and can work your way up to black belt.",
        )}
      </ExplanationText>
    </Explanation>
  );
}
