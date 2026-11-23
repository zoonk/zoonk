"use client";

import { useRouter } from "@/i18n/navigation";
import { getLessonWritingHref } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { MistakesNotebook } from "@zoonk/learn/mistakes";
import { type ComponentProps, startTransition } from "react";
import { resolveMistakeLessonAction } from "./mistake-actions";

export function MistakesNotebookClient(
  props: Omit<ComponentProps<typeof MistakesNotebook>, "openLesson">,
) {
  const router = useRouter();

  async function openLesson(mistakeId: string) {
    const here = openingHere();
    const resolved = await answerHere(resolveMistakeLessonAction(mistakeId), here);

    if (resolved === "left") {
      return true;
    }

    if (resolved === "failed" || !resolved.answer) {
      return false;
    }

    const lessonId = resolved.answer;
    const asked = await answerHere(askToWriteLesson(lessonId), here);

    if (typeof asked === "object") {
      startTransition(() => router.push(getLessonWritingHref({ answer: asked.answer, lessonId })));
    }

    return asked !== "failed";
  }

  return <MistakesNotebook {...props} openLesson={openLesson} />;
}
