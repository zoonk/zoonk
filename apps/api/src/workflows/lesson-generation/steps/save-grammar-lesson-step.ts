import { createStepStream } from "@/workflows/_shared/stream-status";
import { type generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type GrammarLessonContent } from "./_utils/generated-lesson-content";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import { saveGrammarLessonContent } from "./_utils/save-language-lesson-content";
import { type LessonContext } from "./get-lesson-step";

type GrammarContent = Awaited<ReturnType<typeof generateLessonGrammar>>["data"];

export async function saveGrammarLessonStep({
  context,
  grammarContent,
  romanizations,
}: {
  context: LessonContext;
  grammarContent: GrammarContent;
  romanizations: Record<string, string> | null;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveGrammarLesson" });

  const content: GrammarLessonContent = { grammarContent, kind: "grammar" };

  await replaceLessonSteps({
    lessonId: context.id,
    saveSteps: (transaction) =>
      saveGrammarLessonContent({ content, context, romanizations, transaction }),
  });

  await stream.status({ status: "completed", step: "saveGrammarLesson" });
}
