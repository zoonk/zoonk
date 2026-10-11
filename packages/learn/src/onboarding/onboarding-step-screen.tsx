"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { type GenerationRun } from "../generation/generation-run";
import { LanguageLevelTestStep } from "../language/level-test/level-test-step";
import { type PlanActions } from "../plan/plan-context";
import {
  type OnboardingActions,
  type OnboardingRoutes,
  type RevealedPlan,
} from "./onboarding-actions";
import { BuddyStep } from "./steps/buddy-step";
import { ExamChoiceStep } from "./steps/exam-choice-step";
import { readLevelChoice } from "./steps/level-choices";
import { PlacementStep } from "./steps/placement-step";
import { PlanReveal } from "./steps/plan-reveal";
import {
  DateStep,
  type ExamTarget,
  FollowUpsStep,
  LevelStep,
  PurposeStep,
  TextStep,
} from "./steps/question-steps";
import { RoleStep } from "./steps/role-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SubjectsLevelStep } from "./steps/subjects-level-step";

/** How the goal's questions name it: its subject, such as "quantum physics", or its title. */
function getSubject(view: OnboardingView): string {
  const subject = view.goal.details.subject;
  return typeof subject === "string" && subject.trim() ? subject : view.goal.title;
}

/**
 * The language a language learner speaks best, as they told us, falling back to the interface
 * language the goal was typed in. The level test offers the app in it when they differ.
 */
function getNativeLanguage(view: OnboardingView): string {
  const native = view.goal.details.nativeLanguage;
  return typeof native === "string" && native.trim() ? native : view.goal.language;
}

/** The exam's subjects the learner said they know well, as the goal saved them. */
function readKnownSubjects(details: Record<string, unknown>): string[] {
  const known = details.knownSubjects;
  return Array.isArray(known) ? known.filter((name) => typeof name === "string") : [];
}

const EXAM_TARGETS: readonly ExamTarget[] = ["admission", "position", "score"];

/**
 * What the exam's target question asks, from what onboarding understood: a course and score
 * unless the exam ranks a position or reports a score (the question isn't asked for an exam that
 * is only passed).
 */
function getExamTarget(details: Record<string, unknown>): ExamTarget {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? "admission";
}

const QUESTION_STEPS = [
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "examChoice",
  "level",
] as const;

type QuestionStep = (typeof QUESTION_STEPS)[number];

function isQuestionStep(step: OnboardingStep): step is QuestionStep {
  return QUESTION_STEPS.some((question) => question === step);
}

/**
 * A question about the goal: what it's for, the role, why, the target, the date, the exam's
 * choices or the level.
 */
function QuestionStepScreen({
  onAnswer,
  pending,
  step,
  subject,
  view,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  step: QuestionStep;
  subject: string;
  view: OnboardingView;
}) {
  const props = { onAnswer, pending };

  switch (step) {
    case "purpose":
      return <PurposeStep {...props} subject={subject} />;
    case "role":
      return (
        <RoleStep
          {...props}
          purpose={view.goal.details.purpose === "careerChange" ? "careerChange" : "work"}
        />
      );
    case "reason":
      return <TextStep {...props} key={step} question={step} subject={subject} />;
    case "target":
      return (
        <TextStep
          {...props}
          key={step}
          question={getExamTarget(view.goal.details)}
          subject={subject}
        />
      );
    case "targetDate":
      return <DateStep {...props} />;
    case "followUps":
      return <FollowUpsStep {...props} questions={view.followUps} />;
    case "examChoice":
      return <ExamChoiceStep {...props} choices={view.examChoices} subject={subject} />;
    case "level":
      // One level for nine subjects says little: an exam with several asks which they know.
      // Back shows what was picked before.
      return view.examSubjects.length > 1 ? (
        <SubjectsLevelStep
          {...props}
          initialKnown={readKnownSubjects(view.goal.details)}
          subject={subject}
          subjects={view.examSubjects}
        />
      ) : (
        <LevelStep {...props} initialLevel={readLevelChoice(view.goal.details)} subject={subject} />
      );
    default:
      return step satisfies never;
  }
}

/** The screen for one onboarding step. Each answer goes back through the flow. */
export function OnboardingStepScreen({
  actions,
  isGuest,
  onAnswer,
  onPlacementDone,
  pending,
  plan,
  routes,
  run,
  step,
  view,
}: {
  actions: OnboardingActions;
  isGuest: boolean;
  onAnswer: (input: OnboardingAnswerInput) => void;
  onPlacementDone: () => void;
  pending: boolean;
  plan: { initialPlan: RevealedPlan | null; planActions: PlanActions };
  routes: OnboardingRoutes;
  /** The run building the goal's skill map, questions and plan, when the host follows it. */
  run: GenerationRun | null;
  step: OnboardingStep;
  view: OnboardingView;
}) {
  const subject = getSubject(view);
  const props = { onAnswer, pending };

  if (isQuestionStep(step)) {
    return <QuestionStepScreen {...props} step={step} subject={subject} view={view} />;
  }

  switch (step) {
    case "schedule":
      return (
        <ScheduleStep
          {...props}
          // An exam takes its notice's day when the learner gave none.
          dated={view.goal.targetDate !== null || view.goal.kind === "exam"}
          exam={view.goal.kind === "exam"}
          getTimeAdvice={(week) => actions.getTimeAdvice({ goalId: view.goal.id, ...week })}
          recommendedMinutes={view.recommendedMinutes}
          run={run}
        />
      );
    case "buddy":
      return <BuddyStep {...props} />;
    case "placement":
      if (view.goal.kind === "language" && view.goal.targetLanguage) {
        return (
          <LanguageLevelTestStep
            actions={actions.languageLevelTest(view.goal.id)}
            goal={{ language: getNativeLanguage(view), targetLanguage: view.goal.targetLanguage }}
            goalId={view.goal.id}
            onDone={onPlacementDone}
          />
        );
      }

      return (
        <PlacementStep
          actions={actions}
          areaCount={view.examSubjects.length}
          goalId={view.goal.id}
          mockHrefs={{ mock: routes.mock, start: routes.placementMock(view.goal.id) }}
          onDone={onPlacementDone}
          run={run}
          subject={subject}
        />
      );
    case "plan":
      return (
        <PlanReveal
          actions={actions}
          goal={{ kind: view.goal.kind, title: view.goal.title }}
          goalId={view.goal.id}
          initialPlan={plan.initialPlan}
          isGuest={isGuest}
          libraryCourse={
            view.libraryCourse
              ? { course: view.libraryCourse, href: routes.course(view.libraryCourse) }
              : null
          }
          planActions={plan.planActions}
          focusTestHref={routes.focusTest(view.goal.id)}
          planLinkHref={routes.planLink}
          run={run}
          signUpHref={routes.signUp}
          todayHref={routes.today}
        />
      );
    default:
      return null;
  }
}
