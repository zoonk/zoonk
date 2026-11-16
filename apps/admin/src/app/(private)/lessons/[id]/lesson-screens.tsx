import { AdminSectionEmpty, AdminSectionMore } from "@/components/admin-section";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { LessonScreen, type StepAnswers } from "./lesson-screen";

export function LessonScreens({
  answers,
  json,
  lessonId,
  steps,
  translations,
}: {
  answers: Map<string, StepAnswers>;
  json: boolean;
  lessonId: string;
  steps: LibraryLessonStep[];
  /** Each word's translation in this lesson, by word. */
  translations: Map<string, string>;
}) {
  if (steps.length === 0) {
    return <AdminSectionEmpty>This lesson has no screens yet.</AdminSectionEmpty>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y">
        {steps.map((step) => (
          <LessonScreen
            answers={answers.get(step.id)}
            json={json}
            key={step.id}
            step={step}
            translation={step.wordId ? translations.get(step.wordId) : undefined}
          />
        ))}
      </ol>
      <AdminSectionMore href={json ? `/lessons/${lessonId}` : `/lessons/${lessonId}?json=1`}>
        {json ? "Hide technical details" : "Show technical details"}
      </AdminSectionMore>
    </div>
  );
}
