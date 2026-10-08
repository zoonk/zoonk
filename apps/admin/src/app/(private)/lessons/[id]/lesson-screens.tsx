import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { LessonScreen, type StepAnswers } from "./lesson-screen";

/**
 * Every screen in order with its versions, provenance, answers and votes, so admins can see which
 * screen drags a lesson down before rewriting it.
 */
export function LessonScreens({
  answers,
  stepVotes,
  steps,
  variantVotes,
}: {
  answers: Map<string, StepAnswers>;
  stepVotes: Map<string, VoteTotals>;
  steps: LibraryLessonStep[];
  variantVotes: Map<string, VoteTotals>;
}) {
  return (
    <AdminSection
      description="Each screen with its field and tool versions."
      title={`Screens (${steps.length})`}
    >
      {steps.length === 0 ? (
        <AdminSectionEmpty>This lesson has no screens yet.</AdminSectionEmpty>
      ) : (
        <ol className="flex flex-col divide-y">
          {steps.map((step) => (
            <LessonScreen
              answers={answers.get(step.id)}
              key={step.id}
              step={step}
              stepVotes={stepVotes}
              variantVotes={variantVotes}
            />
          ))}
        </ol>
      )}
    </AdminSection>
  );
}
