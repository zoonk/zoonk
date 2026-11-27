"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { Button } from "@zoonk/ui/components/button";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { getBuddyEnergyState } from "@zoonk/utils/buddy";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import {
  createContext,
  use,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";
import { useCountOf } from "../_utils/count-of";
import { type AppearanceBuddy, BuddyEditor } from "../appearance/buddy-settings";
import {
  type TutorConversationContent,
  type TutorSituation,
  useTutorConversationContent,
} from "../conversation/tutor-conversation-content";
import { type DecideTutorPlanChange } from "../conversation/tutor-plan-change";
import { type TutorToolActions } from "../conversation/tutor-tool-offer";
import { type MissionLinks } from "../missions/mission-links";
import { PageWithAside } from "../shell/learn-shell";
import {
  type BuddyConversationList,
  BuddyConversations,
  BuddyConversationsSheet,
} from "./buddy-conversations";
import { BuddyGlassesSheet } from "./buddy-glasses-sheet";
import { BUDDY_COLUMN_CLASS, BuddyHeader } from "./buddy-header";
import { type BuddyHrefs, BuddyMenu } from "./buddy-menu";
import { type BuddyStatusView, toLearnBuddy } from "./buddy-status-view";
import { BuddyToday } from "./buddy-today";
import { type LearnBuddy } from "./use-buddy-name";

export { type BuddyConversation, type BuddyConversationList } from "./buddy-conversations";
export { BuddyScreenSkeleton } from "./buddy-screen-skeleton";
export type { BuddyHrefs } from "./buddy-menu";
export { BuddyGoalStart } from "./buddy-goal-start";
export type { MissionLinks } from "../missions/mission-links";
export type { BuddyStatusView } from "./buddy-status-view";
export type {
  TutorConversationContent,
  TutorSituation,
} from "../conversation/tutor-conversation-content";

const TutorContentContext = createContext<TutorConversationContent | null>(null);

export function useBuddyTutor(): TutorConversationContent {
  const content = use(TutorContentContext);

  if (!content) {
    throw new Error("useBuddyTutor must be used inside BuddyScreen");
  }

  return content;
}

type BuddyScreenActions = {
  decidePlanChange: DecideTutorPlanChange;
  missionLinks: MissionLinks;
  saveBuddy: (buddy: AppearanceBuddy) => Promise<boolean>;
  tools: TutorToolActions;
};

function useBuddyChanges({
  initial,
  saveBuddy,
}: {
  initial: ResolvedBuddy;
  saveBuddy: BuddyScreenActions["saveBuddy"];
}) {
  const [current, setCurrent] = useOptimistic(initial);
  const [, startTransition] = useTransition();
  const failedMessage = useChangeSaveErrorMessage();
  const latestSave = useRef(0);

  function save(next: AppearanceBuddy) {
    latestSave.current += 1;
    const request = latestSave.current;

    startTransition(async () => {
      setCurrent({ ...next, picked: true });
      const { data: saved } = await safeAsync(() => saveBuddy(next));

      // A toast, not a line on the page, so a failed save moves nothing under it.
      if (request === latestSave.current && !saved) {
        showErrorToast(failedMessage);
      }
    });
  }

  return { current, save };
}

/** Only with a fine pointer: on a phone, focus would raise the keyboard over the conversation. */
function focusComposerOnPointer(column: HTMLElement | null) {
  if (globalThis.matchMedia("(pointer: fine)").matches) {
    column?.querySelector("textarea")?.focus({ preventScroll: true });
  }
}

function useFocusComposerOnPointer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusComposerOnPointer(ref.current);
  }, []);

  return ref;
}

function PickBuddyButton({ onPick }: { onPick: () => void }) {
  const t = useExtracted();

  return (
    <Button aria-haspopup="dialog" onClick={onPick} size="lg" variant="outline">
      {t("Choose your buddy")}
    </Button>
  );
}

/**
 * Only while awake: asleep it naps on, and glowing it's already beaming, so a smile would swap its
 * face away.
 */
function useChatFace(buddy: LearnBuddy) {
  const face = useRef<ActorHandle<BuddyActName>>(null);
  const awake = getBuddyEnergyState(buddy.energy, { studiedToday: buddy.studiedToday }) === "awake";

  const react = (act: BuddyActName) => {
    if (awake) {
      void face.current?.play(act);
    }
  };

  return { face, onAnswered: () => react("smile"), onAsked: () => react("glance") };
}

function useGlassesCount(status: BuddyStatusView): string {
  const countOf = useCountOf();
  return countOf(status.glasses.filter((item) => item.earned).length, status.glasses.length);
}

export function BuddyScreen({
  actions,
  children,
  conversations,
  hrefs,
  situation,
  status,
}: {
  actions: BuddyScreenActions;
  children: React.ReactNode;
  /** Null for a guest, who can't ask and so has none. */
  conversations: BuddyConversationList | null;
  hrefs: BuddyHrefs;
  situation: TutorSituation;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const [editing, setEditing] = useState(false);
  const [wearing, setWearing] = useState(false);
  const columnRef = useFocusComposerOnPointer();

  const { current, save } = useBuddyChanges({
    initial: status.buddy,
    saveBuddy: actions.saveBuddy,
  });

  const buddy = toLearnBuddy({ buddy: current, status });
  const chatFace = useChatFace(buddy);

  const content = useTutorConversationContent({
    buddy,
    decide: actions.decidePlanChange,
    situation,
    tools: actions.tools,
  });

  const name = content.identity.name;
  const glassesCount = useGlassesCount(status);

  const missionLinks: MissionLinks = {
    ...actions.missionLinks,
    askBuddy: () => columnRef.current?.querySelector("textarea")?.focus(),
  };

  const tutorContent: TutorConversationContent = {
    ...content,
    greetingAction: current.picked ? undefined : (
      <PickBuddyButton onPick={() => setEditing(true)} />
    ),
    onAnswered: chatFace.onAnswered,
    onAsked: chatFace.onAsked,
  };

  return (
    <PageWithAside
      aside={
        conversations && (
          <BuddyConversations
            list={conversations}
            onOpen={() => focusComposerOnPointer(columnRef.current)}
          />
        )
      }
      asideClassName="hidden"
      asideLabel={t("Conversations")}
      className="flex-1"
    >
      <div className={BUDDY_COLUMN_CLASS} data-slot="buddy-screen" ref={columnRef}>
        <BuddyHeader
          buddy={buddy}
          faceRef={chatFace.face}
          menu={
            <div className="flex items-center gap-4">
              {conversations && (
                <BuddyConversationsSheet className="min-[72rem]:hidden" list={conversations} />
              )}
              <BuddyMenu
                buddy={current}
                glassesCount={glassesCount}
                hrefs={hrefs}
                name={name}
                onEdit={() => setEditing(true)}
                onGlasses={() => setWearing(true)}
              />
            </div>
          }
          name={name}
        >
          <BuddyToday
            buddy={buddy}
            energyHref={hrefs.energy}
            missionLinks={missionLinks}
            name={name}
            status={status}
          />
        </BuddyHeader>

        <TutorContentContext value={tutorContent}>{children}</TutorContentContext>
      </div>

      <BuddyGlassesSheet
        buddy={buddy}
        glasses={status.glasses}
        onOpenChange={setWearing}
        onWear={(glasses) => save({ glasses, kind: buddy.kind, name: buddy.name })}
        open={wearing}
      />

      {editing && (
        <BuddyEditor
          initial={{ glasses: current.glasses, kind: current.kind, name: current.name ?? "" }}
          look={buddy}
          onClose={() => setEditing(false)}
          picked={current.picked}
          onSave={(choice) => {
            setEditing(false);

            save({ glasses: choice.glasses, kind: choice.kind, name: choice.name.trim() || null });
          }}
        />
      )}
    </PageWithAside>
  );
}
