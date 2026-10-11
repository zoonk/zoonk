"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(learn)/journey/journey-actions";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type TutorCardActions, type TutorCards, getTutorCards } from "@zoonk/learn/tutor-cards";
import { useMemo } from "react";

/**
 * Where each feature the buddy offers opens. Choosing where to focus is the Journey with its
 * "Choose where to focus" sheet open; a written test is its subject's page.
 */
const TOOL_HREFS: TutorCardActions["tools"]["hrefs"] = {
  chooseFocus: "/journey?focus=choose",
  chooseMock: MOCK_ENTRY_HREFS.choose,
  course: ({ brandSlug, slug }) => getCourseHref({ brandSlug, courseSlug: slug }),
  logbook: "/logbook",
  memory: "/settings/memory",
  mistakes: "/mistakes",
  pronunciation: "/pronunciation",
  startGoal: getGoalStartHref,
  stats: "/stats",
  subject: (key) => `/journey/${key}`,
};

/**
 * How the buddy's cards work for the goal it tutors, on its tab and on every screen it's asked
 * from: a plan change is answered as the Journey answers one, then the page reads itself again;
 * a feature opens where main shows it.
 */
export function useTutorCardActions(goalId: string): TutorCardActions {
  const router = useRouter();
  const startTestOut = useStartTestOut();
  const startConversation = useStartLanguageConversation();

  return useMemo(
    () => ({
      decide: async ({ changeId, status }) => {
        const answered = await answerPlanChangeAction(goalId, { changeId, status });

        if (answered) {
          router.refresh();
        }

        return answered;
      },
      tools: {
        hrefs: TOOL_HREFS,
        startConversation: ({ chapterId, goalId: callGoalId, minutes }) =>
          startConversation({ chapterId, goalId: callGoalId, kind: "practice", minutes }),
        startTestOut,
      },
    }),
    [goalId, router, startConversation, startTestOut],
  );
}

/**
 * The buddy's cards under its answers on a screen inside the goal it tutors (a chapter, a lesson,
 * a mock); none without a goal, whose answers never carry one. The lesson player isn't a learn
 * screen, so each card brings main's learn links and analytics with it.
 */
export function useTutorCards(goalId: string | null): TutorCards | null {
  const actions = useTutorCardActions(goalId ?? "");

  return useMemo(() => {
    if (!goalId) {
      return null;
    }

    const cards = getTutorCards(actions);

    return {
      renderPlanChange: (input) => (
        <MainLearnProvider>{cards.renderPlanChange(input)}</MainLearnProvider>
      ),
      renderToolOffer: (offer) => (
        <MainLearnProvider>{cards.renderToolOffer(offer)}</MainLearnProvider>
      ),
    };
  }, [actions, goalId]);
}
