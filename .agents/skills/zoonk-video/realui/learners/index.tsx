import { GoalEntry } from "@repo/packages/learn/src/onboarding/entry/goal-entry.tsx";
// The stage's views: ?view=learner-<screen>&learner=<id>&lang=<the learner's language>.
import { type OnboardingActions } from "@repo/packages/learn/src/onboarding/onboarding-actions.ts";
import { OnboardingFrame } from "@repo/packages/learn/src/onboarding/onboarding-frame.tsx";
import { OnboardingRailProvider } from "@repo/packages/learn/src/onboarding/onboarding-rail.tsx";
import { PlanReveal } from "@repo/packages/learn/src/onboarding/steps/plan-reveal.tsx";
import { ScheduleStep } from "@repo/packages/learn/src/onboarding/steps/schedule-step.tsx";
import { type PlanActions } from "@repo/packages/learn/src/plan/plan-context.tsx";
import { type TodayActions } from "@repo/packages/learn/src/today/today-context.tsx";
import { TodayScreen } from "@repo/packages/learn/src/today/today-screen.tsx";
import { OnboardingShell, TabShell, noop, type ViewProps } from "../learn/common";
import { getLearner } from "./learners";
import {
  goalView,
  planView,
  syllabusView,
  timeAdvice,
  timeToCover,
  todayView,
  firstDay,
} from "./view-models";

/** Actions are behavior, not data: a still screen never calls them, so each is a no-op unless given. */
function actions<T extends object>(given: Partial<T>): T {
  return new Proxy(given, {
    get: (target, key) => (key in target ? target[key as keyof T] : async () => null),
  }) as T;
}

/** The goal box with the first `typed` characters of the learner's sentence (all of it by default). */
function GoalScreen({ q }: ViewProps) {
  const { goal } = getLearner(q.get("learner"));
  const typed = Number(q.get("typed") ?? goal.text.length);
  const value = goal.text.slice(0, Math.max(0, typed));

  return (
    <OnboardingShell>
      <GoalEntry
        defaultGoal={value}
        error={null}
        hasAccount
        key={value}
        onAttach={noop}
        onSubmit={noop}
        signUpHref="/login"
      />
    </OnboardingShell>
  );
}

/** "How much time can you study each day?" at the learner's time, or at `minutes`. */
function TimeScreen({ q }: ViewProps) {
  const learner = getLearner(q.get("learner"));
  const picked = Number(q.get("minutes") ?? learner.minutesPerDay);

  return (
    <OnboardingShell>
      <OnboardingFrame bar={{ onBack: noop }}>
        <ScheduleStep
          dated
          draft={{ days: [1, 2, 3, 4, 5], picked, weekendOn: false, weekendPicked: null }}
          exam={learner.goal.kind === "exam"}
          findTimeToCover={async () => timeToCover(learner)}
          firstLesson={null}
          getTimeAdvice={async (week) => timeAdvice(learner, week.dailyMinutes ?? picked)}
          goal={goalView(learner, picked)}
          languageAim={null}
          lessonHref={(id) => `/learn/${id}`}
          library={null}
          onAnswer={noop}
          onChangeAim={async () => true}
          onChangeDate={noop}
          pending={false}
          planReadiness={{ readingNotice: false, ready: true }}
          readWarmUp={async () => null}
          recommendedMinutes={learner.everythingMinutes ?? learner.minutesPerDay}
          run={null}
          startsOnRecommended={false}
          together={{ count: 1, place: 0 }}
        />
      </OnboardingFrame>
    </OnboardingShell>
  );
}

/** "Your plan is ready": the readouts, what the time covers, and the path or the exam's subjects. */
function RevealScreen({ q }: ViewProps) {
  const learner = getLearner(q.get("learner"));
  const revealed = {
    plan: planView(learner),
    reveal: { today: firstDay(learner) },
    syllabus: syllabusView(learner),
  };

  return (
    <OnboardingShell>
      <OnboardingRailProvider rail={null}>
        <OnboardingFrame bar={{ end: null, middle: null, onBack: undefined }}>
          <PlanReveal
            actions={actions<OnboardingActions>({
              getPlan: async () => ({ status: "ready", ...revealed }),
              markPlanRevealed: async () => true,
              readWarmUp: async () => null,
            })}
            firstLesson={null}
            focusTestHref="/focus-test"
            goal={{ displayName: learner.goal.displayName, kind: learner.goal.kind }}
            goalId={learner.goalId}
            initialPlan={revealed}
            isGuest={false}
            lessonHref={(id) => `/learn/${id}`}
            library={null}
            planActions={actions<PlanActions>({})}
            planLinkHref={(id) => `/plans/${id}`}
            run={null}
            signUpHref="/login"
            toToday={noop}
          />
        </OnboardingFrame>
      </OnboardingRailProvider>
    </OnboardingShell>
  );
}

const TODAY_ACTIONS = actions<TodayActions>({
  adjustTimeHref: "/plan?focus=time",
  buddyHref: "/buddy",
  challengeHref: (id) => `/challenge/${id}`,
  chooseFocusHref: "/plan?focus=choose",
  completedLessonsHref: "/completed-lessons",
  continueHref: null,
  examHref: "/exam",
  lessonAgainHref: (id) => `/learn/${id}`,
  lessonHref: () => null,
  mistakesHref: "/mistakes",
  plusHref: "/subscription",
  refresh: noop,
  studyEverythingHref: "/plan?focus=everything",
  summaryHref: "/session",
});

/** Today on the plan's first day, before any lesson. */
function TodayTab({ q }: ViewProps) {
  const learner = getLearner(q.get("learner"));
  const { targetLanguage } = learner.goal;

  return (
    <TabShell
      goal={{
        dailyMinutes: learner.minutesPerDay,
        id: learner.goalId,
        kind: learner.goal.kind,
        languageFlag: learner.goal.languageFlag,
        targetDate: learner.goal.targetDate,
        targetLanguage: learner.goal.targetLanguage,
        targetRegion: learner.goal.targetRegion,
        title: learner.goal.displayName,
      }}
      missions={{ done: 0, total: 3 }}
      tab="today"
    >
      <TodayScreen
        actions={TODAY_ACTIONS}
        buddy={null}
        language={targetLanguage ? { level: null, targetLanguage } : null}
        readAt={0}
        today={todayView(learner)}
      />
    </TabShell>
  );
}

export const views = {
  "learner-goal": GoalScreen,
  "learner-reveal": RevealScreen,
  "learner-time": TimeScreen,
  "learner-today": TodayTab,
};
