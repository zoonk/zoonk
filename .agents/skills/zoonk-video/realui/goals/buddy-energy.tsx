import { getGlassesProgress } from "@repo/packages/core/src/milestones/milestone-rules.ts";
import { BRAIN_POWER_BONUS } from "@repo/packages/core/src/sessions/brain-power.ts";
import {
  BuddyScreen,
  type BuddyStatusView,
  useBuddyTutor,
} from "@repo/packages/learn/src/buddies/buddy-screen.tsx";
import { type TutorToolActions } from "@repo/packages/learn/src/conversation/tutor-tool-offer.tsx";
import { TutorConversation } from "@repo/packages/player/src/questions/tutor-conversation.tsx";
import { calculateBeltLevel, getBeltStartBrainPower } from "@repo/packages/utils/src/belt-level.ts";
import {
  getBuddyEnergyState,
  getBuddyStage,
  getNextBuddyStage,
} from "@repo/packages/utils/src/buddy.ts";
import { type ComponentProps, useEffect } from "react";
// The Buddy tab: header with the Energy chip, the buddy and the tutor conversation.
import { Link, MISSION_LINKS, actions } from "../learn/common";
import { type Lang, story } from "../story";
import { AppFrame, NOOP } from "./shell";

type BuddyActions = ComponentProps<typeof BuddyScreen>["actions"];

export const DEFAULT_BP = 4340;

/** The belt, stage and next growth the app derives in packages/core/src/milestones/get-buddy-status.ts. */
export function buddyGrowth(bp: number) {
  const belt = calculateBeltLevel(bp);
  const next = getNextBuddyStage(belt.color);

  return {
    belt: { ...belt, totalBrainPower: bp },
    nextStage: next && {
      ...next,
      brainPowerToGo: Math.max(0, getBeltStartBrainPower(next.belt) - bp),
    },
    stage: getBuddyStage(belt.color),
  };
}

export function buddyStatus({
  bp = DEFAULT_BP,
  energy,
  lang,
  studied,
}: {
  bp?: number;
  energy: number | null;
  lang: Lang;
  studied: boolean;
}): BuddyStatusView {
  return {
    ...buddyGrowth(bp),
    buddy: { glasses: "round", kind: "zu", name: story[lang].buddyName, picked: true },
    energy: {
      current: energy,
      state: getBuddyEnergyState(energy, { studiedToday: studied }),
      studiedToday: studied,
    },
    firstSteps: null,
    glasses: getGlassesProgress({
      bigChallenges: 0,
      bossesWon: 1,
      capsulesOpened: 12,
      finalBossesWon: 0,
      fullMeals: 4,
    }),
    thisWeek: { fixes: 3, newIdeas: 6, reviews: 4 },
    today: {
      fullMeal: { bonus: BRAIN_POWER_BONUS.fullMeal, earned: false },
      goalId: "exam",
      localDate: "2026-11-03",
      missions: studied
        ? [
            { done: 1, kind: "somethingNew", status: "done", total: 1 },
            { done: 0, kind: "review", minutes: 5, status: "todo", total: 1 },
            { done: 0, kind: "practice", minutes: 4, status: "todo", total: 1 },
          ]
        : [
            { done: 0, kind: "somethingNew", minutes: 8, status: "todo", total: 1 },
            { done: 0, kind: "review", minutes: 5, status: "todo", total: 1 },
            { done: 0, kind: "practice", minutes: 4, status: "todo", total: 1 },
          ],
    },
  };
}

export function tabBuddy(status: BuddyStatusView) {
  return {
    beltColor: status.belt.color,
    energy: status.energy.current,
    glasses: status.buddy.glasses,
    kind: status.buddy.kind,
    name: status.buddy.name,
    studiedToday: status.energy.studiedToday,
  };
}

/** Taps an element once the page has painted, to show a sheet or a later step. */
export function AutoClick({ selector, when = true }: { selector: string; when?: boolean }) {
  useEffect(() => {
    if (!when) return;
    const timer = setTimeout(() => document.querySelector<HTMLElement>(selector)?.click(), 150);
    return () => clearTimeout(timer);
  }, [selector, when]);
  return null;
}

const EMPTY_THREAD = { hasMore: false, nextCursor: null, questions: [] };

const TUTOR = {
  buddy: null,
  canAsk: true,
  connection: { apiUrl: "http://localhost:9", getHeaders: async () => ({}) },
  navigation: { linkComponent: Link, loginHref: "/login", subscriptionHref: "/subscription" },
};

const CONVERSATION_ID = "5d3e8a1c-2b4f-4e6a-9c7d-1f0a2b3c4d5e";

/** A learner who hasn't asked yet: a blank conversation, and no list to open. */
const NO_CONVERSATIONS = {
  conversationHref: (id: string) => `/buddy/${id}`,
  conversations: [],
  more: null,
  newHref: "/buddy/new",
  openId: null,
};

function Conversation() {
  const content = useBuddyTutor();
  return (
    <TutorConversation
      conversationId={CONVERSATION_ID}
      goalId="exam"
      thread={EMPTY_THREAD}
      tutor={TUTOR}
      {...content}
    />
  );
}

export function BuddyTab({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const energyParam = q.get("energy");
  const energy = energyParam === "none" ? null : Number(energyParam ?? 82);
  const studied = (q.get("studied") ?? "1") === "1";
  const bp = Number(q.get("bp") ?? DEFAULT_BP);
  const status = buddyStatus({ bp, energy, lang, studied });
  const missions = status.today?.missions ?? [];

  return (
    <AppFrame
      buddy={tabBuddy(status)}
      goal="exam"
      lang={lang}
      missions={{
        done: missions.filter((m) => m.status === "done").length,
        total: missions.length,
      }}
      tab="buddy"
    >
      <BuddyScreen
        actions={actions<BuddyActions>({
          missionLinks: { ...MISSION_LINKS, askBuddy: NOOP },
          saveBuddy: async () => true,
          tools: actions<TutorToolActions>({}),
        })}
        conversations={NO_CONVERSATIONS}
        hrefs={{ energy: "/energy", logbook: "/logbook", memory: "/settings/memory" }}
        situation={{ hasMistake: true, hasToday: true }}
        status={status}
      >
        <Conversation />
      </BuddyScreen>
      <AutoClick
        selector="[data-slot=buddy-today] button[aria-haspopup=dialog]"
        when={q.get("sheet") === "1"}
      />
    </AppFrame>
  );
}
