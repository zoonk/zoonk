"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { getBuddyEnergyState } from "@zoonk/utils/buddy";
import { safeAsync } from "@zoonk/utils/error";
import {
  CalendarDaysIcon,
  EllipsisIcon,
  GlassesIcon,
  HistoryIcon,
  PencilIcon,
  SmileIcon,
} from "lucide-react";
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
import { ChangeSaveError } from "../_components/save-error";
import { type AppearanceBuddy, BuddyEditor } from "../appearance/buddy-settings";
import {
  type TutorConversationContent,
  type TutorSituation,
  useTutorConversationContent,
} from "../conversation/tutor-conversation-content";
import { type DecideTutorPlanChange } from "../conversation/tutor-plan-change";
import { type TutorToolActions } from "../conversation/tutor-tool-offer";
import { LearnLink } from "../learn-link";
import { type MissionLinks } from "../missions/mission-links";
import { PageWithAside } from "../shell/learn-shell";
import { BuddyDay, type BuddyDayHrefs } from "./buddy-day";
import { BuddyGlassesSheet } from "./buddy-glasses-sheet";
import { BUDDY_COLUMN_CLASS, BuddyHeader } from "./buddy-header";
import { type BuddyStatusView, toLearnBuddy } from "./buddy-status-view";
import { BuddyToday } from "./buddy-today";
import { type LearnBuddy } from "./use-buddy-name";

export { BuddyDaySkeleton } from "./buddy-day";
export { BUDDY_COLUMN_CLASS } from "./buddy-header";
export { BuddyGoalStart } from "./buddy-goal-start";
export { BuddyTabName } from "./buddy-labels";
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

export type BuddyScreenHrefs = BuddyDayHrefs & { earlierQuestions?: string };

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
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const latestSave = useRef(0);

  function save(next: AppearanceBuddy) {
    latestSave.current += 1;
    const request = latestSave.current;
    setFailed(false);

    startTransition(async () => {
      setCurrent({ ...next, picked: true });
      const { data: saved } = await safeAsync(() => saveBuddy(next));

      if (request === latestSave.current) {
        setFailed(!saved);
      }
    });
  }

  return { current, failed, save };
}

/** Only with a fine pointer: on a phone, focus would raise the keyboard over the conversation. */
function useFocusComposerOnPointer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (globalThis.matchMedia("(pointer: fine)").matches) {
      ref.current?.querySelector("textarea")?.focus({ preventScroll: true });
    }
  }, []);

  return ref;
}

function BuddyMenu({
  buddy,
  glassesCount,
  hrefs,
  name,
  onEdit,
  onGlasses,
}: {
  buddy: ResolvedBuddy;
  glassesCount: string;
  hrefs: BuddyScreenHrefs;
  name: string;
  onEdit: () => void;
  onGlasses: () => void;
}) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="text-muted-foreground shrink-0" size="icon-sm" variant="ghost" />
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("More about {buddy}", { buddy: name })}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onEdit}>
          {buddy.picked ? <PencilIcon aria-hidden="true" /> : <SmileIcon aria-hidden="true" />}
          {buddy.picked ? t("Change {buddy}", { buddy: name }) : t("Choose your buddy")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onGlasses}>
          <GlassesIcon aria-hidden="true" />
          <span className="flex-1">{t("Glasses")}</span>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {glassesCount}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<LearnLink href={hrefs.logbook} />}>
          <CalendarDaysIcon aria-hidden="true" />
          {t("Weekly summary")}
        </DropdownMenuItem>

        {hrefs.earlierQuestions && (
          <DropdownMenuItem render={<LearnLink href={hrefs.earlierQuestions} />}>
            <HistoryIcon aria-hidden="true" />
            {t("Earlier questions")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PickBuddyButton({ onPick }: { onPick: () => void }) {
  const t = useExtracted();

  return (
    <Button aria-haspopup="dialog" onClick={onPick} size="sm" variant="outline">
      <SmileIcon aria-hidden="true" />
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
  const t = useExtracted();
  const earned = status.glasses.filter((item) => item.earned).length;
  return t("{earned} of {total}", { earned: String(earned), total: String(status.glasses.length) });
}

export function BuddyScreen({
  actions,
  children,
  hrefs,
  memoryCount,
  situation,
  status,
}: {
  actions: BuddyScreenActions;
  children: React.ReactNode;
  hrefs: BuddyScreenHrefs;
  memoryCount?: number;
  situation: TutorSituation;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const [editing, setEditing] = useState(false);
  const [wearing, setWearing] = useState(false);
  const columnRef = useFocusComposerOnPointer();

  const { current, failed, save } = useBuddyChanges({
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
        <BuddyDay
          buddy={buddy}
          hrefs={hrefs}
          memoryCount={memoryCount}
          missionLinks={missionLinks}
          name={name}
          onGlasses={() => setWearing(true)}
          status={status}
        />
      }
      asideClassName="hidden"
      asideLabel={t("{buddy} today", { buddy: name })}
      className="flex-1"
    >
      <div className={BUDDY_COLUMN_CLASS} data-slot="buddy-screen" ref={columnRef}>
        <BuddyHeader buddy={buddy} faceRef={chatFace.face} name={name} stage={status.stage}>
          <BuddyToday
            buddy={buddy}
            className="min-[72rem]:hidden"
            energyHref={hrefs.energy}
            missionLinks={missionLinks}
            name={name}
            status={status}
          />

          <BuddyMenu
            buddy={current}
            glassesCount={glassesCount}
            hrefs={hrefs}
            name={name}
            onEdit={() => setEditing(true)}
            onGlasses={() => setWearing(true)}
          />
        </BuddyHeader>

        {failed && !editing && <ChangeSaveError />}

        <TutorContentContext value={tutorContent}>{children}</TutorContentContext>
      </div>

      <BuddyGlassesSheet
        buddy={buddy}
        failed={failed}
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
          onSave={(choice) => {
            setEditing(false);

            save({ glasses: choice.glasses, kind: choice.kind, name: choice.name.trim() || null });
          }}
        />
      )}
    </PageWithAside>
  );
}
