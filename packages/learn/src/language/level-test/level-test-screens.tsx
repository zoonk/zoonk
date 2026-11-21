"use client";

import { type LanguageLevelTestView } from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../../_utils/locale";
import { useLanguageNameInSentence } from "../../_utils/use-language-name";
import { TestOutcome } from "../../onboarding/test-outcome";
import { PlacementLengthChoice } from "../../placement-test/placement-test-screens";
import { getPlacementPressed } from "../../placement-test/use-placement-test";
import { LevelBars } from "./level-test-parts";

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;

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

export function TestIntro({
  goal,
  onScratch,
  onStart,
  onSwitch,
  pending,
  showAlphabetNote,
  starting,
  wholeCourseMinutes,
}: {
  goal: { language: string; targetLanguage: string };
  onScratch: () => void;
  onStart: React.ComponentProps<typeof PlacementLengthChoice>["onStart"];
  onSwitch: (language: string) => void;
  pending: boolean;
  showAlphabetNote: boolean;
  starting: boolean;
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();

  return (
    <PlacementLengthChoice
      failed={false}
      onSkip={onScratch}
      onStart={onStart}
      pressed={getPlacementPressed({ pending, starting })}
      wholeCourseMinutes={wholeCourseMinutes}
    >
      {showAlphabetNote && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("New to its alphabet? Skip the test. Your first lesson teaches you to read it.")}
        </p>
      )}

      <InterfaceOffer language={goal.language} onSwitch={onSwitch} />
    </PlacementLengthChoice>
  );
}

export function TestDone({
  failed,
  levels,
  onContinue,
  pending,
  targetLanguage,
}: {
  failed: boolean;
  levels: ReadyTest["levels"];
  onContinue: () => void;
  pending: boolean;
  targetLanguage: string;
}) {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();

  return (
    <TestOutcome
      busy={pending}
      failed={failed}
      onContinue={onContinue}
      subject={t("Level test")}
      title={t("Your {language} level", { language: languageName(targetLanguage) })}
    >
      <LevelBars levels={levels} />
    </TestOutcome>
  );
}
