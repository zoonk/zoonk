import { createStepStream } from "@/workflows/_shared/stream-status";
import { type generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type generateLessonGrammarUserContent } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type GrammarLessonContent } from "./_utils/generated-lesson-content";
import { saveGrammarLessonContent } from "./_utils/save-language-lesson-content";
import { type LessonContext } from "./get-lesson-step";

type GrammarContent = Awaited<ReturnType<typeof generateLessonGrammarContent>>["data"];
type GrammarUserContent = Awaited<ReturnType<typeof generateLessonGrammarUserContent>>["data"];

export async function saveGrammarLessonStep({
  context,
  grammarContent,
  romanizations,
  userContent,
}: {
  context: LessonContext;
  grammarContent: GrammarContent;
  romanizations: Record<string, string> | null;
  userContent: GrammarUserContent;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveGrammarLesson" });

  const content: GrammarLessonContent = {
    grammarContent,
    kind: "grammar",
    userContent,
  };

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await saveGrammarLessonContent({ content, context, romanizations });

  await stream.status({ status: "completed", step: "saveGrammarLesson" });
}
