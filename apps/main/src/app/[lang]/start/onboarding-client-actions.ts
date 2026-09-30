import { setModeAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { getCourseHref } from "@/data/courses/course-href";
import { getPathname } from "@/i18n/navigation";
import { askMaterialQuestion } from "@/lib/goals/goal-material-questions";
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
  getPlanAction,
  inviteGuardianAction,
  joinWaitlistAction,
  startOverAction,
} from "./onboarding-actions";
import { createGoalsFromPlanLinkAction } from "./plan-link-actions";
import { WEB_UNDERSTANDING_ACTIONS } from "./understanding-client-actions";

/**
 * Onboarding's actions for the web: the app's Server Actions, which call the same core
 * capabilities as the public API. A visitor becomes a guest before their goal is read, so the
 * goal, placement and plan are theirs and move to their account when they sign up. Material goes
 * through the uploads API from the browser, since files go straight to storage.
 */
export const WEB_ONBOARDING_ACTIONS: OnboardingActions = {
  // The mode answer is this device's pick too, so every page shows it, before and after sign-in.
  answer: async ({ goalId, input }) => {
    const outcome = await answerOnboardingAction(goalId, input);

    if (input.question === "mode" && outcome.status === "saved") {
      await setModeAction(input.experienceMode);
    }

    return outcome;
  },
  answerPlacement: (input) => answerPlacementAction({ ...input, timeZone: getLocalTimeZone() }),
  askMaterial: askMaterialQuestion,
  attach: { file: attachGoalFile, link: attachGoalLink, text: attachGoalText },
  createGoals: async (input) =>
    (await ensureGuestSession()) ? createOnboardingGoalsAction(input) : { status: "failed" },
  finishPlacement: (input) => finishPlacementAction({ ...input, timeZone: getLocalTimeZone() }),
  getPlacement: (goalId) => getPlacementAction({ goalId, timeZone: getLocalTimeZone() }),
  getPlan: getPlanAction,
  inviteGuardian: inviteGuardianAction,
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
    // A document navigation, like the language setting, so the proxy keeps the choice.
    switchLanguage: (language) => {
      if (isValidLocale(language)) {
        globalThis.location.replace(
          getPathname({ forcePrefix: true, href: `/start/${goalId}`, locale: language }),
        );
      }
    },
  }),
  recordPlanWait: (milliseconds) =>
    recordGenerationWaitAction({ contentKind: "curriculum", milliseconds }),
  startOver: startOverAction,
  understanding: WEB_UNDERSTANDING_ACTIONS,
};

export const WEB_ONBOARDING_ROUTES: OnboardingRoutes = {
  course: getCourseHref,
  explore: "/courses",
  planLink: (planId) => `/plan-link/${planId}`,
  signUp: "/login",
  today: "/today",
};

/**
 * Onboarding opened from someone's plan link (`/start?plan=`): the same steps, and the goal starts
 * from that plan's structure instead of a new plan.
 */
export function getPlanLinkOnboardingActions(planId: string): OnboardingActions {
  return {
    ...WEB_ONBOARDING_ACTIONS,
    createGoals: async (input) =>
      (await ensureGuestSession())
        ? createGoalsFromPlanLinkAction(planId, input)
        : { status: "failed" },
  };
}
