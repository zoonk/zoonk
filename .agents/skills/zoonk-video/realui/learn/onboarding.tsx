// Onboarding screens after the goal box: placement question, daily time, understood card, plan reveal.
import { type GoalView } from "@repo/packages/core/src/goals/goal-contract.ts";
import {
  type PlanTimeAdvice,
  type PlanTimeToCover,
} from "@repo/packages/core/src/plans/time-advice-contract.ts";
import { type OnboardingStep } from "@repo/packages/core/src/view-models/onboarding/onboarding-contract.ts";
import { StepDots } from "@repo/packages/learn/src/_components/step-dots.tsx";
import { getSetupProgress } from "@repo/packages/learn/src/onboarding/_utils/setup-progress.ts";
import { BAR_MIDDLE_CLASS } from "@repo/packages/learn/src/onboarding/onboarding-bar.tsx";
import { OnboardingFrame } from "@repo/packages/learn/src/onboarding/onboarding-frame.tsx";
import { OnboardingRailProvider } from "@repo/packages/learn/src/onboarding/onboarding-rail.tsx";
import { PlanReceipt } from "@repo/packages/learn/src/onboarding/plan-receipt.tsx";
import { StartOverMenu } from "@repo/packages/learn/src/onboarding/start-over-menu.tsx";
import { PlacementQuestionScreen } from "@repo/packages/learn/src/onboarding/steps/placement-question.tsx";
import { PlanReveal } from "@repo/packages/learn/src/onboarding/steps/plan-reveal.tsx";
import { ScheduleStep } from "@repo/packages/learn/src/onboarding/steps/schedule-step.tsx";
import { UnderstoodScreen } from "@repo/packages/learn/src/onboarding/understood/understood-screen.tsx";
import { type ReactNode, useEffect } from "react";
import { OnboardingShell, S, noop, noopAsync, type ViewProps } from "./common";
import { ACTIONS as PLAN_ACTIONS, careerPlan, careerSyllabus } from "./plan";

export const CAREER_ID = "goal-career";

/** The career goal as the server holds it once the "understood" card was confirmed. */
export function careerGoal(lang: "en" | "pt", extra: Partial<GoalView> = {}): GoalView {
  const c = S(lang).career;

  return {
    createdAt: "2026-11-03T15:00:00.000Z",
    dailyMinutes: c.minutesPerDay,
    details: {
      answered: ["purpose", "role", "targetDate", "level"],
      purpose: "careerChange",
      targetPosition: c.title,
    },
    examBlueprintId: null,
    id: CAREER_ID,
    isActive: true,
    kind: "learn",
    language: lang === "pt" ? "pt" : "en",
    plan: null,
    primaryCourseId: null,
    prompt: c.goalText,
    status: "active",
    studyDays: [1, 2, 3, 4, 5],
    studyTime: null,
    targetDate: c.date,
    targetLanguage: null,
    timezone: "America/Sao_Paulo",
    title: c.title,
    ...extra,
  };
}

/** StepsFlow's bar for a question screen: Back, the step dots, and the "⋯" start-over menu. */
function StepsBar({
  children,
  current,
  goal,
  history,
  steps,
}: {
  children: ReactNode;
  current: OnboardingStep;
  goal: GoalView;
  history: OnboardingStep[];
  steps: OnboardingStep[];
}) {
  const progress = getSetupProgress({ current, history, view: { steps } });

  return (
    <OnboardingRailProvider rail={<PlanReceipt goal={goal} />}>
      <OnboardingFrame
        bar={{
          end: <StartOverMenu disabled={false} onStartOver={noop} />,
          middle: progress && (
            <StepDots
              className={BAR_MIDDLE_CLASS}
              current={progress.current}
              total={progress.total}
            />
          ),
          onBack: history.length > 0 ? noop : undefined,
        }}
      >
        {children}
      </OnboardingFrame>
    </OnboardingRailProvider>
  );
}

// ---- 3. diagnostic --------------------------------------------------------------------------

/** "picked": the moment "I don't know yet" is tapped, in the outline button's own pressed look. */
function usePressedDontKnow(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.querySelector("svg.lucide-circle-question-mark, svg.lucide-circle-help"),
      );
      if (button) {
        button.setAttribute("aria-expanded", "true");
        clearInterval(id);
      }
    }, 20);
    return () => clearInterval(id);
  }, [on]);
}

function DiagnosticView({ lang, state, q }: ViewProps) {
  const c = S(lang).career;
  usePressedDontKnow(state === "picked");

  return (
    <OnboardingShell>
      <StepsBar
        current="placement"
        goal={careerGoal(lang)}
        history={["level", "schedule", "buddy"]}
        steps={["placement", "plan"]}
      >
        <PlacementQuestionScreen
          number={Number(q.get("number") ?? 3)}
          onAnswer={noop}
          onStop={noop}
          pending={false}
          progress={Number(q.get("progress") ?? 0.3)}
          question={{
            context: null,
            format: "multipleChoice",
            image: null,
            itemId: "placement-chart",
            options: [...c.diagnosticOptions],
            question: c.diagnosticQuestion,
            skillId: "skill-chart-choice",
            visual: null,
          }}
          subject={c.title}
        />
      </StepsBar>
    </OnboardingShell>
  );
}

// ---- 4. schedule ----------------------------------------------------------------------------

const EVERYTHING_MINUTES = 145;

function timeToCover(lang: "en" | "pt"): PlanTimeToCover {
  return {
    fittingDate: null,
    most: null,
    pastDate: false,
    readingNotice: false,
    ready: true,
    recommendedMinutes: EVERYTHING_MINUTES,
    suggested: {
      coveredShare: 1,
      everyTopic: true,
      kind: "everything",
      minutes: EVERYTHING_MINUTES,
      split: null,
    },
    targetDate: S(lang).career.date,
    targetDateNamedMonth: false,
  };
}

function timeAdvice(lang: "en" | "pt", minutes: number): PlanTimeAdvice {
  return {
    coveredShare: minutes >= EVERYTHING_MINUTES ? 1 : S(lang).career.coverage,
    endDate: null,
    fullCourseEndDate: null,
    measure: "goal",
    numbers: null,
    readingNotice: false,
    ready: true,
    targetDate: S(lang).career.date,
    targetDateNamedMonth: false,
  };
}

function ScheduleView({ lang, state }: ViewProps) {
  const goal = careerGoal(lang);
  const picked = state === "after" ? EVERYTHING_MINUTES : S(lang).career.minutesPerDay;

  return (
    <OnboardingShell>
      <StepsBar
        current="schedule"
        goal={goal}
        history={["level"]}
        steps={["schedule", "buddy", "placement", "plan"]}
      >
        <ScheduleStep
          dated
          draft={{
            days: [1, 2, 3, 4, 5],
            fullCourse: false,
            picked,
            weekendOn: false,
            weekendPicked: null,
          }}
          findTimeToCover={async () => timeToCover(lang)}
          getTimeAdvice={async (week) => timeAdvice(lang, week.dailyMinutes)}
          goal={goal}
          onAnswer={noop}
          onChangeDate={noop}
          pending={false}
          planReadiness={{ readingNotice: false, ready: true }}
          recommendedMinutes={60}
          run={null}
          together={{ count: 1, place: 0 }}
        />
      </StepsBar>
    </OnboardingShell>
  );
}

// ---- 2. understood ---------------------------------------------------------------------------

/** What the learner said they do today, read from story.career.goalText ("I work in sales today"). */
const CURRENT_ROLE = { en: "Sales", pt: "Vendas" } as const;

function UnderstoodView({ lang }: ViewProps) {
  const c = S(lang).career;

  return (
    <OnboardingShell>
      <OnboardingFrame bar={{ onBack: noop }}>
        <UnderstoodScreen
          draft={{
            goals: [
              {
                cutoff: null,
                draft: {
                  details: {
                    answered: ["purpose", "role", "targetDate"],
                    purpose: "careerChange",
                    role: CURRENT_ROLE[lang],
                    targetPosition: c.title,
                  },
                  kind: "learn",
                  language: lang,
                  prompt: c.goalText,
                  targetDate: c.date,
                  title: c.title,
                },
                examDates: [],
              },
            ],
            lockedGoals: [],
            minutesSaid: false,
            schedule: {
              dailyMinutes: c.minutesPerDay,
              studyDays: null,
              studyTime: null,
              studyTimeNote: null,
            },
          }}
          error={null}
          goal={c.goalText}
          isCreating={false}
          material={[]}
          onConfirm={noop}
          onRevise={async () => true}
          onRewrite={noop}
          signUpHref="/login"
        />
      </OnboardingFrame>
    </OnboardingShell>
  );
}

// ---- 5. reveal ------------------------------------------------------------------------------

function RevealView({ lang }: ViewProps) {
  const c = S(lang).career;
  const revealed = { plan: careerPlan(lang), syllabus: careerSyllabus(lang) };

  return (
    <OnboardingShell>
      <OnboardingRailProvider rail={null}>
        <OnboardingFrame bar={{ end: null, middle: null, onBack: undefined }}>
          <PlanReveal
            actions={
              {
                getPlan: async () => ({ status: "ready", ...revealed }),
                recordPlanWait: async () => {},
              } as any
            }
            focusTestHref="/focus-test"
            goal={{ kind: "learn", title: c.title }}
            goalId={CAREER_ID}
            initialPlan={revealed}
            isGuest={false}
            libraryCourse={null}
            planActions={PLAN_ACTIONS as any}
            planLinkHref={(id) => `/plans/${id}`}
            refreshPages={noop}
            run={null}
            signUpHref="/login"
            todayHref="/today"
          />
        </OnboardingFrame>
      </OnboardingRailProvider>
    </OnboardingShell>
  );
}

export const views: Record<string, (p: ViewProps) => any> = {
  understood: UnderstoodView,
  diagnostic: DiagnosticView,
  schedule: ScheduleView,
  reveal: RevealView,
};
