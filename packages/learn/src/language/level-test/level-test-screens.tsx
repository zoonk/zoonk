"use client";

import { Button } from "@zoonk/ui/components/button";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../../_utils/locale";
import { PlacementLengthChoice } from "../../placement-test/placement-test-screens";
import { type PlacementPressed } from "../../placement-test/use-placement-test";

function InterfaceOffer({
  language,
  onSwitch,
}: {
  language: string;
  onSwitch: (language: string) => void;
}) {
  const t = useExtracted();
  const locale = useAppLocale();

  if (language === locale || !isValidLocale(language)) {
    return null;
  }

  return (
    <Button
      className="self-start"
      lang={language}
      onClick={() => onSwitch(language)}
      variant="link"
    >
      {t("Use the app in {language}", {
        language: getLanguageNameInSentence({ targetLanguage: language, userLanguage: language }),
      })}
    </Button>
  );
}

/** The length choice as onboarding opens it: the learner can skip the test or switch the app to their own language. */
export function TestIntro({
  failed,
  language,
  onSkip,
  onStart,
  onSwitch,
  pressed,
  showAlphabetNote,
  wholeCourseMinutes,
}: {
  failed: boolean;
  language: string;
  onSkip: () => void;
  onStart: React.ComponentProps<typeof PlacementLengthChoice>["onStart"];
  onSwitch: (language: string) => void;
  pressed: PlacementPressed;
  showAlphabetNote: boolean;
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();

  return (
    <PlacementLengthChoice
      failed={failed}
      onSkip={onSkip}
      onStart={onStart}
      pressed={pressed}
      wholeCourseMinutes={wholeCourseMinutes}
    >
      {showAlphabetNote && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("New to its alphabet? Skip the test. Your first lesson teaches you to read it.")}
        </p>
      )}

      <InterfaceOffer language={language} onSwitch={onSwitch} />
    </PlacementLengthChoice>
  );
}
