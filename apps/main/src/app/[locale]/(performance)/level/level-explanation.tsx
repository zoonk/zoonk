import {
  Explanation,
  ExplanationText,
  ExplanationTitle,
} from "@zoonk/ui/components/explanation";
import { getExtracted } from "next-intl/server";

export async function LevelExplanation() {
  const t = await getExtracted();

  return (
    <Explanation>
      <ExplanationTitle>{t("About Levels")}</ExplanationTitle>

      <ExplanationText>
        {t(
          "Brain Power (BP) represents your knowledge growth. Unlike energy, BP never decreases - it only grows as you learn more.",
        )}
      </ExplanationText>

      <ExplanationText>
        {t(
          "Every time you complete an activity, you earn Brain Power. As you accumulate BP, you progress through 10 belt colors, each with 10 levels.",
        )}
      </ExplanationText>

      <ExplanationText>
        {t(
          "Belt colors in order: White, Yellow, Orange, Green, Blue, Purple, Brown, Red, Gray, and Black. Keep learning to reach the highest level!",
        )}
      </ExplanationText>
    </Explanation>
  );
}
