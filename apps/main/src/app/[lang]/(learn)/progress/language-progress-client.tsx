"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { LanguageProgressScreen } from "@zoonk/learn/language/progress";
import { PROGRESS_HREFS } from "./progress-screen-client";

/** A language goal's Progress, with the current unit's page and the speaking mock wired up. */
export function LanguageProgressClient({
  language,
  progress,
}: {
  language: LanguageProgressView;
  progress: ProgressView;
}) {
  const startConversation = useStartLanguageConversation();
  const { currentUnit, goal } = language;

  return (
    <LanguageProgressScreen
      actions={{
        startSpeakingMock: () => startConversation({ goalId: goal.id, kind: "speakingMock" }),
      }}
      hrefs={{
        ...PROGRESS_HREFS,
        unit: currentUnit ? `/content/units/${currentUnit.chapterId}` : null,
      }}
      language={language}
      progress={progress}
    />
  );
}
