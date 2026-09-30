import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { type DepthRequestsResult, readDepthRequests } from "@/data/lessons/get-depth-requests";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { DepthRequestsNote } from "./lesson-depth-requests";
import { LessonScreen, type StepAnswers } from "./lesson-screen";

/**
 * Every screen in order with its versions, provenance, answers, votes and Simpler or Go deeper
 * taps, so admins can see which screen drags a lesson down before rewriting it.
 */
export function LessonScreens({
  answers,
  depthRequests,
  stepVotes,
  steps,
  variantVotes,
}: {
  answers: Map<string, StepAnswers>;
  depthRequests: DepthRequestsResult;
  stepVotes: Map<string, VoteTotals>;
  steps: LibraryLessonStep[];
  variantVotes: Map<string, VoteTotals>;
}) {
  return (
    <AdminSection
      description="Each screen with its Simpler, Go deeper, field and tool versions."
      title={`Screens (${steps.length})`}
    >
      {steps.length === 0 ? (
        <AdminSectionEmpty>This lesson has no screens yet.</AdminSectionEmpty>
      ) : (
        <>
          <DepthRequestsNote result={depthRequests} />
          <ol className="flex flex-col divide-y">
            {steps.map((step) => (
              <LessonScreen
                answers={answers.get(step.id)}
                depthRequests={
                  depthRequests.status === "ok"
                    ? readDepthRequests(depthRequests.requests, step.id)
                    : null
                }
                key={step.id}
                step={step}
                stepVotes={stepVotes}
                variantVotes={variantVotes}
              />
            ))}
          </ol>
        </>
      )}
    </AdminSection>
  );
}
