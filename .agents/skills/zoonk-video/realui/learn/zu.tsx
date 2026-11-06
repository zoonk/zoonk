import { getGlassesProgress } from "@repo/packages/core/src/milestones/milestone-rules.ts";
import { BRAIN_POWER_BONUS } from "@repo/packages/core/src/sessions/brain-power.ts";
import {
  BuddyScreen,
  type BuddyStatusView,
  useBuddyTutor,
} from "@repo/packages/learn/src/buddies/buddy-screen.tsx";
import { type LessonTutorConfig } from "@repo/packages/player/src/lesson/tutor/lesson-tutor-context.ts";
import { TutorConversation } from "@repo/packages/player/src/questions/tutor-conversation.tsx";
import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
// The buddy tab (/buddy) on a phone: Zu's conversation with "I want to study less this week",
// Zu's answer, and the real "Change to your plan" card (proposed, or applied with Undo).
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useEffect, useMemo } from "react";
import { buddyGrowth } from "../goals/buddy-energy";
import { CAREER_GOAL_ID, S, TabShell, type ViewProps } from "./common";

const TODAY_ISO = "2026-11-03";

/** Zu's own words: the reply the tutor model writes before its proposal card. */
const REPLY = {
  en: "Sure, a lighter week is a good way to keep going without burning out. I can make this a light week: half your daily time, about 30 minutes a day, through next Monday. Nothing is skipped, so your plan just ends a few days later. Tap **Apply** if that works for you.",
  pt: "Claro, uma semana mais leve ajuda a manter o ritmo sem se cansar. Posso deixar esta semana leve: metade do seu tempo por dia, uns 30 minutos, até a próxima segunda. Nada fica de fora, então o plano só termina alguns dias depois. Toque em **Aplicar** se fizer sentido para você.",
} as const;

const BRAIN_POWER = 410;

function buddyStatus(): BuddyStatusView {
  return {
    ...buddyGrowth(BRAIN_POWER),
    buddy: { glasses: "round", kind: "zu", name: null, picked: true },
    energy: { current: 72, state: "awake", studiedToday: false },
    firstSteps: null,
    glasses: getGlassesProgress({
      bigChallenges: 0,
      bossesWon: 0,
      capsulesOpened: 0,
      finalBossesWon: 0,
      fullMeals: 2,
    }),
    thisWeek: { fixes: 0, newIdeas: 6, reviews: 2 },
    today: {
      fullMeal: { bonus: BRAIN_POWER_BONUS.fullMeal, earned: false },
      goalId: CAREER_GOAL_ID,
      localDate: TODAY_ISO,
      missions: [
        { done: 1, kind: "somethingNew", status: "done", total: 1 },
        { done: 0, kind: "review", minutes: 5, status: "todo", total: 1 },
        { done: 0, kind: "askBuddy", opens: { kind: "buddy" }, status: "todo", total: 1 },
      ],
    },
  } as BuddyStatusView;
}

function planChange(applied: boolean): PlanChangeView {
  return {
    behind: null,
    canApply: true,
    canUndo: applied,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    days: null,
    effect: {
      endDateAfter: "2027-05-07",
      endDateBefore: "2027-05-03",
      lessonsAdded: 0,
      lessonsRemoved: 0,
    },
    examDocument: "notice",
    id: "6f1c2a4e-1b7d-4c55-9a51-3f0f2a9c7d10",
    kind: "edited",
    lessonsSkipped: 0,
    officialDate: null,
    operations: [{ kind: "addLightWeek", startDate: TODAY_ISO }],
    reason: null,
    seen: false,
    source: "tutor",
    status: applied ? "applied" : "proposed",
    todaySession: applied ? "changed" : null,
  } as PlanChangeView;
}

function question(lang: "en" | "pt", applied: boolean): LessonQuestionResource {
  const at = new Date(Date.now() - 60_000).toISOString();

  return {
    answer: REPLY[lang],
    context: { kind: "plan" } as any,
    createdAt: at,
    id: "0b6f8f62-5f0e-4f8e-8f7a-6a3f0e1c2d34",
    planChange: planChange(applied),
    question: S(lang).zuAsk,
    status: "completed",
    toolOffer: null,
    updatedAt: at,
  };
}

function Link({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <a className={className} href={href} onClick={(event) => event.preventDefault()}>
      {children}
    </a>
  );
}

const TUTOR: LessonTutorConfig = {
  buddy: null,
  canAsk: true,
  connection: { apiUrl: "http://localhost:5199/__no-api/", getHeaders: async () => ({}) },
  navigation: { linkComponent: Link, loginHref: "/login", subscriptionHref: "/subscription" },
};

function Conversation({ lang, applied }: { lang: "en" | "pt"; applied: boolean }) {
  const content = useBuddyTutor();

  const thread = useMemo(
    () => ({
      hasMore: false,
      id: "2c9d1a7e-7a0b-4f43-b0a8-8d7b5e7f9a11",
      lessonId: null,
      nextCursor: null,
      questions: [question(lang, applied)],
    }),
    [lang, applied],
  );

  return (
    <TutorConversation goalId={CAREER_GOAL_ID} initialThread={thread} tutor={TUTOR} {...content} />
  );
}

const noopHref = () => "#";

/**
 * On open the conversation follows its latest turn (useFollowLatest in tutor-conversation.tsx),
 * which here means the page's end; the lazy answer markdown lands after that effect, so redo it.
 * `scroll=top` keeps the unscrolled page instead.
 */
function useFollowLatestTurn(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const id = setInterval(() => window.scrollTo(0, document.documentElement.scrollHeight), 50);
    const stop = setTimeout(() => clearInterval(id), 3000);

    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [enabled]);
}

function ZuTab({ lang, q, state }: ViewProps) {
  const career = S(lang).career;
  const applied = state === "applied";
  const status = useMemo(buddyStatus, []);
  useFollowLatestTurn(q.get("scroll") !== "top");

  return (
    <TabShell
      buddy={{
        beltColor: "white",
        energy: 72,
        glasses: "round",
        kind: "zu",
        name: null,
        studiedToday: false,
      }}
      goal={{
        dailyMinutes: 60,
        id: CAREER_GOAL_ID,
        kind: "career",
        targetDate: career.date,
        title: career.title,
      }}
      missions={{ done: 1, total: 3 }}
      tab="buddy"
    >
      <BuddyScreen
        actions={{
          decidePlanChange: async ({ status: decided }) =>
            ({ ...planChange(decided === "applied"), status: decided }) as PlanChangeView,
          missionLinks: {
            hrefs: {
              areaPractice: noopHref,
              buddy: "/buddy",
              call: noopHref,
              mistakesPractice: "/mistakes",
              mockChooser: "/mock/new",
              pattern: noopHref,
              pronunciation: "/speaking",
            },
            openBlock: async () => false,
          },
          saveBuddy: async () => true,
          tools: {
            hrefs: {
              chooseFocus: "#",
              chooseMock: "#",
              course: noopHref,
              logbook: "/logbook",
              memory: "/settings/memory",
              mistakes: "/mistakes",
              pronunciation: "/speaking",
              startGoal: noopHref,
              stats: "/stats",
              subject: noopHref,
            },
          } as any,
        }}
        hrefs={{
          energy: "/energy",
          logbook: "/logbook",
          memory: "/settings/memory",
          earlierQuestions: "/buddy/earlier-questions",
        }}
        memoryCount={4}
        situation={{ hasMistake: false, hasToday: true }}
        status={status}
      >
        <Conversation applied={applied} lang={lang} />
      </BuddyScreen>
    </TabShell>
  );
}

export const views: Record<string, (p: ViewProps) => any> = { "zu-tab": ZuTab };
