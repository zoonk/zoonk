"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { LanguageUnitScreen } from "@zoonk/learn/language/unit";
import { LessonRichTextBlocks } from "@zoonk/player/lesson/rich-text";

/**
 * The unit page with "Practice a conversation" wired to core and the call screen, "Take the test"
 * opening its test-out, and grammar tips and summaries drawn with the lesson player's text.
 */
export function UnitScreenClient({ unit }: { unit: LanguageUnitView }) {
  const startConversation = useStartLanguageConversation();
  const startTestOut = useStartTestOut();
  const { chapterId } = unit.unit;
  const goalId = unit.goalId ?? undefined;

  return (
    <LanguageUnitScreen
      actions={{
        startConversation: (minutes) =>
          startConversation({ chapterId, goalId, kind: "practice", minutes }),
        startTestOut: async () =>
          goalId ? startTestOut({ chapterId, goalId }) : { status: "failed" },
      }}
      hrefs={{
        back: "/journey",
        lesson: (lessonId) => `/learn/${lessonId}`,
        pattern: (patternId) => `/pattern/${patternId}`,
        pronunciation: goalId ? `/pronunciation?goal=${goalId}` : "/pronunciation",
      }}
      renderLessonText={(text) => <LessonRichTextBlocks text={text} />}
      unit={unit}
    />
  );
}
