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
import { AgeStep, GuardianInviteStep, TooYoung } from "./steps/age-step";
import { BuddyStep } from "./steps/buddy-step";
import { MemoryStep } from "./steps/memory-step";
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

const EXAM_TARGETS: readonly ExamTarget[] = ["admission", "position", "score"];

/**
 * What the exam's target question asks, from what onboarding understood: a course and score
 * unless the exam ranks a position or reports a score (the question isn't asked for an exam that
 * is only passed).
 */
function getExamTarget(details: Record<string, unknown>): ExamTarget {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? "admission";
}

/** The month and year the learner said the exam is in ("in March 2027"), when they said both. */
const QUESTION_STEPS = [
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "level",
] as const;

type QuestionStep = (typeof QUESTION_STEPS)[number];

function isQuestionStep(step: OnboardingStep): step is QuestionStep {
  return QUESTION_STEPS.some((question) => question === step);
}

/** A question about the goal: what it's for, the role, why, the target, the date or the level. */
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
    case "level":
      // One level for nine subjects says little: an exam with several asks which they know.
      return view.examSubjects.length > 1 ? (
        <SubjectsLevelStep {...props} subject={subject} subjects={view.examSubjects} />
      ) : (
        <LevelStep {...props} subject={subject} />
      );
    default:
      return step satisfies never;
  }
}

/** The screen for one onboarding step. Each answer goes back through the flow. */
export function OnboardingStepScreen({
  actions,
  inviting,
  isGuest,
  onAnswer,
  onGuardianDone,
  onPlacementDone,
  pending,
  plan,
  routes,
  run,
  step,
  tooYoung,
  view,
}: {
  actions: OnboardingActions;
  inviting: boolean;
  isGuest: boolean;
  onAnswer: (input: OnboardingAnswerInput) => void;
  onGuardianDone: () => void;
  onPlacementDone: () => void;
  pending: boolean;
  plan: { initialPlan: RevealedPlan | null; planActions: PlanActions };
  routes: OnboardingRoutes;
  /** The run building the goal's skill map, questions and plan, when the host follows it. */
  run: GenerationRun | null;
  step: OnboardingStep;
  tooYoung: boolean;
  view: OnboardingView;
}) {
  const subject = getSubject(view);
  const props = { onAnswer, pending };

  if (tooYoung) {
    return <TooYoung />;
  }

  if (inviting) {
    return <GuardianInviteStep onDone={onGuardianDone} onInvite={actions.inviteGuardian} />;
  }

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
          getTimeAdvice={(studyDays) => actions.getTimeAdvice({ goalId: view.goal.id, studyDays })}
          recommendedMinutes={view.recommendedMinutes}
        />
      );
    case "age":
      return <AgeStep {...props} />;
    case "memory":
      return <MemoryStep {...props} isMinor={view.isMinor} />;
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
