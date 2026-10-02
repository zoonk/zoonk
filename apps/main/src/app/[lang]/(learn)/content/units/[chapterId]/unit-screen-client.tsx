"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { LanguageUnitScreen } from "@zoonk/learn/language/unit";
import { LessonRichTextBlocks } from "@zoonk/player/lesson/rich-text";

/**
 * The unit page with "Practice a conversation" wired to core and the call screen, and grammar
 * tips drawn with the lesson player's text (emphasis and short lists).
 */
export function UnitScreenClient({ unit }: { unit: LanguageUnitView }) {
  const startConversation = useStartLanguageConversation();
  const { chapterId } = unit.unit;
  const goalId = unit.goalId ?? undefined;

  return (
    <LanguageUnitScreen
      actions={{
        startConversation: (minutes) =>
          startConversation({ chapterId, goalId, kind: "practice", minutes }),
      }}
      backHref="/content"
      renderLessonText={(text) => <LessonRichTextBlocks text={text} />}
      unit={unit}
    />
  );
}
