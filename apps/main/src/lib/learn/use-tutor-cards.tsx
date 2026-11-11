"use client";

import { applyGoalCountryAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { getLearnerGeneration, mergeLearnerSummary } from "@/lib/learner/learner-store";
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
  const learner = useFrameLearner();
  const goals = learner.status === "ready" ? learner.summary.goals : null;

  return useMemo(
    () => ({
      decide: async ({ changeId, status }) => {
        const answered = await answerPlanChangeAction(goalId, {
          changeId,
          status,
          surface: "tutor",
        });

        if (answered) {
          router.refresh();
        }

        return answered;
      },
      tools: {
        getGoalRegion: (id) => goals?.find((goal) => goal.id === id)?.targetRegion ?? null,
        hrefs: TOOL_HREFS,
        setGoalRegion: async ({ goalId: id, region }) => {
          const generation = getLearnerGeneration();
          const summary = await applyGoalCountryAction(id, region);
          mergeLearnerSummary({ generation, summary });

          if (summary) {
            router.refresh();
          }

          return summary !== null;
        },
        startConversation: ({ chapterId, goalId: callGoalId, minutes }) =>
          startConversation({ chapterId, goalId: callGoalId, kind: "practice", minutes }),
        startTestOut,
      },
    }),
    [goalId, goals, router, startConversation, startTestOut],
  );
}

export type MainTutorCards = TutorCards & { appLinks: ReturnType<typeof useTutorAppLinks> };

/** The lesson player isn't a learn screen, so each card brings main's learn links and analytics with it. */
export function useTutorCards(goalId: string | null): MainTutorCards | null {
  const actions = useTutorCardActions(goalId ?? "");
  const appLinks = useTutorAppLinks();

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
