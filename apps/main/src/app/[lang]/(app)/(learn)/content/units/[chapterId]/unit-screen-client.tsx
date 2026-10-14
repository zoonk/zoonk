"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { LanguageUnitScreen } from "@zoonk/learn/language/unit";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { useMemo } from "react";

/**
 * The unit page with "Practice a conversation" wired to core and the call screen, "Take the test"
 * opening its test-out, "Ask" for questions about it as a chapter's page has, and grammar tips and
 * summaries drawn with the lesson player's text.
 */
export function UnitScreenClient({
  tutor,
  unit,
  upNext,
}: {
  tutor: TutorViewer;
  unit: LanguageUnitView;
  /** The unit holds the plan's next lesson. */
  upNext: boolean;
}) {
  const startConversation = useStartLanguageConversation();
  const startTestOut = useStartTestOut();
  const { chapterId } = unit.unit;
  const goalId = unit.goalId ?? undefined;
  const target = useMemo(() => ({ chapterId, kind: "chapter" as const }), [chapterId]);

  return (
    <LanguageUnitScreen
      actions={{
        startConversation: (minutes) =>
          startConversation({ chapterId, goalId, kind: "practice", minutes }),
        startTestOut: async () =>
          goalId ? startTestOut({ chapterId, goalId }) : { status: "failed" },
      }}
      ask={<MainAskTutor {...tutor} size="bar" target={target} />}
      hrefs={{
        back: "/plan",
        lesson: (lessonId) => `/learn/${lessonId}`,
        pattern: (patternId) => `/pattern/${patternId}`,
        pronunciation: goalId ? `/pronunciation?goal=${goalId}` : "/pronunciation",
      }}
      renderLessonText={(text) => <RichTextBlocks text={text} />}
      unit={unit}
      upNext={upNext}
    />
  );
}
