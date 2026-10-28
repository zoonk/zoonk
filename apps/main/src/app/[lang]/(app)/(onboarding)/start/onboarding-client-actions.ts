import { getCourseHref } from "@/data/courses/course-href";
import { getPathname } from "@/i18n/navigation";
import { rememberLocale } from "@/i18n/remember-locale";
import { askMaterialQuestion } from "@/lib/goals/goal-material-questions";
import { findGoalTimeToCover, getGoalTimeAdvice } from "@/lib/goals/goal-time-advice";
import { attachGoalFile, attachGoalLink, attachGoalText } from "@/lib/goals/goal-uploads";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { type OnboardingActions, type OnboardingRoutes } from "@zoonk/learn/onboarding/actions";
import { isValidLocale } from "@zoonk/utils/locale";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerLevelTestAction,
  finishLevelTestAction,
  getLevelTestAction,
  speakLevelTestAction,
  startLevelTestBankAction,
} from "./language-level-test-actions";
import {
  answerOnboardingAction,
  answerPlacementAction,
  createOnboardingGoalsAction,
  finishPlacementAction,
  getPlacementAction,
  getPlacementMockAction,
  getPlanAction,
  joinWaitlistAction,
  startOverAction,
  stopPlacementMockAction,
} from "./onboarding-actions";
import { createGoalsFromPlanLinkAction } from "./plan-link-actions";
import { WEB_UNDERSTANDING_ACTIONS } from "./understanding-client-actions";

/**
 * A visitor becomes a guest before their goal is read, so what follows is theirs and moves to their
 * account. Material goes through the uploads API from the browser: files go straight to storage.
 */
export const WEB_ONBOARDING_ACTIONS: OnboardingActions = {
  answer: ({ goalId, input }) => answerOnboardingAction(goalId, input),
  answerPlacement: (input) => answerPlacementAction({ ...input, timeZone: getLocalTimeZone() }),
  askMaterial: askMaterialQuestion,
  attach: { file: attachGoalFile, link: attachGoalLink, text: attachGoalText },
  createGoals: async (input) =>
    (await ensureGuestSession()) ? createOnboardingGoalsAction(input) : { status: "failed" },
  findTimeToCover: findGoalTimeToCover,
  finishPlacement: (input) => finishPlacementAction({ ...input, timeZone: getLocalTimeZone() }),
  getPlacement: (goalId) => getPlacementAction({ goalId, timeZone: getLocalTimeZone() }),
  getPlacementMock: getPlacementMockAction,
  getPlan: getPlanAction,
  getTimeAdvice: getGoalTimeAdvice,
  joinWaitlist: joinWaitlistAction,
  languageLevelTest: (goalId) => ({
    answer: (input) => answerLevelTestAction(goalId, input),
    finish: () => finishLevelTestAction(goalId),
    get: () => getLevelTestAction(goalId),
    prepare: () => startLevelTestBankAction(goalId),
    speak: (audio) => {
      const form = new FormData();
      form.set("audio", audio);
      return speakLevelTestAction(goalId, form);
    },
    // Saved, then a document navigation, like the language setting.
    switchLanguage: (language) => {
      if (isValidLocale(language)) {
        rememberLocale(language);

        globalThis.location.replace(
          getPathname({ forcePrefix: true, href: `/start/${goalId}`, locale: language }),
        );
      }
    },
  }),
  recordPlanWait: (milliseconds) =>
    recordGenerationWaitAction({ contentKind: "curriculum", milliseconds }),
  startOver: startOverAction,
  stopPlacementMock: (mockId) => stopPlacementMockAction(mockId, getLocalTimeZone()),
  understanding: WEB_UNDERSTANDING_ACTIONS,
};

export const WEB_ONBOARDING_ROUTES: OnboardingRoutes = {
  course: getCourseHref,
  focusTest: (goalId) => `/focus-test?goal=${goalId}`,
  mock: (mockId) => `/mock/${mockId}`,
  placementMock: (goalId) => `/mock/placement/${goalId}`,
  planLink: (planId) => `/plan-link/${planId}`,
  signUp: "/login",
  today: "/today",
};

export function getPlanLinkOnboardingActions(planId: string): OnboardingActions {
  return {
    ...WEB_ONBOARDING_ACTIONS,
    createGoals: async (input) =>
      (await ensureGuestSession())
        ? createGoalsFromPlanLinkAction(planId, input)
        : { status: "failed" },
  };
}
