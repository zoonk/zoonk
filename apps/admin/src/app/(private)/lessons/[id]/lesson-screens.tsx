import { AdminSectionEmpty } from "@/components/admin-section";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { LessonScreen, type StepAnswers } from "./lesson-screen";

export function LessonScreens({
  answers,
  steps,
}: {
  answers: Map<string, StepAnswers>;
  steps: LibraryLessonStep[];
}) {
  if (steps.length === 0) {
    return <AdminSectionEmpty>This lesson has no screens yet.</AdminSectionEmpty>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y">
        {steps.map((step) => (
          <LessonScreen answers={answers.get(step.id)} key={step.id} step={step} />
        ))}
      </ol>
    </div>
  );
}
