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

/**
 * What the host's conversation, placed as the buddy screen's child, needs from the buddy: its name
 * and face, its hello, the composer's words, the first suggestions and the plan change card.
 */
export function useBuddyTutor(): TutorConversationContent {
  const content = use(TutorContentContext);

  if (!content) {
    throw new Error("useBuddyTutor must be used inside BuddyScreen");
  }

  return content;
}

/**
 * Where the buddy tab leads: Energy over time, what the buddy remembers and the week's summary.
 * Statistics open from the account menu and the level in the top bar.
 */
export type BuddyScreenHrefs = BuddyDayHrefs & {
  /** The learner's questions from an earlier version of their courses, when they have any. */
  earlierQuestions?: string;
};

/**
 * How the buddy tab saves: the buddy (kind, name and glasses), resolving to whether it was saved,
 * and the learner's answer to a plan change the buddy proposed in the conversation. Today's
 * missions open where they're done (`missionLinks`).
 */
type BuddyScreenActions = {
  decidePlanChange: DecideTutorPlanChange;
  missionLinks: MissionLinks;
  saveBuddy: (buddy: AppearanceBuddy) => Promise<boolean>;
  /** How the app tools the buddy offers in the conversation open. */
  tools: TutorToolActions;
};

/**
 * A pending choice shows at once, reconciled against the latest server profile so a retained
 * page follows edits from Preferences. Only the latest save can report a failure.
 */
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

/**
 * With a mouse or trackpad, the tab opens ready to type: the conversation's field takes focus. On
 * a phone it waits for a tap, so the keyboard doesn't cover the conversation.
 */
function useFocusComposerOnPointer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (globalThis.matchMedia("(pointer: fine)").matches) {
      ref.current?.querySelector("textarea")?.focus({ preventScroll: true });
    }
  }, []);

  return ref;
}

/** What's done now and then with the buddy: change it, its glasses and the week's summary. */
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

/**
 * The default buddy gently offers choosing a look and name under its hello.
 */
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
 * The buddy's face at the top of its tab, reacting to the conversation: it glances at what the
 * learner sends and smiles when its answer comes in. Only while it's awake: asleep it naps on, and
 * glowing it's already beaming, with its eyes shut, so a smile would swap its face away.
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

/**
 * The buddy tab: the learner's conversation with their buddy, their tutor for the goal. The buddy
 * sits on one compact row on top (its face, name and stage, and the rest behind its "…"); the
 * conversation takes the screen, its suggestions and composer always within reach. On a phone or
 * a tablet the buddy's day is one quiet line of Energy and missions that opens its sheet; on a
 * wide screen it sits beside the conversation instead (`BuddyDay`), which keeps a comfortable
 * line length. The default buddy's hello offers choosing a buddy.
 * The host places the conversation as its child, which reads the buddy with `useBuddyTutor`.
 */
export function BuddyScreen({
  actions,
  children,
  hrefs,
  memoryCount,
  situation,
  status,
}: {
  actions: BuddyScreenActions;
  /** The conversation, which reads what it needs from `useBuddyTutor`. */
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

  // Here, asking the buddy something is the composer on this page, not a link to it.
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
      // Under 72rem the day is a tap away in its sheet (`BuddyToday`), not under the conversation.
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
