"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type TutorCardActions, type TutorCards, getTutorCards } from "@zoonk/learn/tutor-cards";
import { useMemo } from "react";
import { useTutorAppLinks } from "./use-tutor-app-links";

const TOOL_HREFS: TutorCardActions["tools"]["hrefs"] = {
  chooseFocus: "/plan?focus=choose",
  chooseMock: MOCK_ENTRY_HREFS.choose,
  course: ({ brandSlug, slug }) => getCourseHref({ brandSlug, courseSlug: slug }),
  logbook: "/logbook",
  memory: "/settings/memory",
  mistakes: "/mistakes",
  pronunciation: "/pronunciation",
  startGoal: getGoalStartHref,
  stats: "/stats",
  subject: (key) => `/plan/${key}`,
};

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

export type MainTutorCards = TutorCards & { appLinks: ReturnType<typeof useTutorAppLinks> };

/** The lesson player isn't a learn screen, so each card brings main's learn links and analytics with it. */
export function useTutorCards(goalId: string | null): MainTutorCards | null {
  const actions = useTutorCardActions(goalId ?? "");
  const appLinks = useTutorAppLinks(goalId ?? "");

  return useMemo(() => {
    if (!goalId) {
      return null;
    }

    const cards = getTutorCards(actions);

    return {
      appLinks,
      renderPlanChange: (input) => (
        <MainLearnProvider>{cards.renderPlanChange(input)}</MainLearnProvider>
      ),
      renderToolOffer: (offer) => (
        <MainLearnProvider>{cards.renderToolOffer(offer)}</MainLearnProvider>
      ),
    };
  }, [actions, appLinks, goalId]);
}
