"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarDaysIcon, EllipsisIcon, GlassesIcon, PencilIcon, SmileIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useState } from "react";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowTitle,
} from "../_components/list-group";
import { PageSubtitle, PageTitle } from "../_components/page";
import { type AppearanceBuddy, BuddyEditor } from "../appearance/buddy-settings";
import {
  type TutorConversationContent,
  type TutorSituation,
  useTutorConversationContent,
} from "../conversation/tutor-conversation-content";
import { type DecideTutorPlanChange } from "../conversation/tutor-plan-change";
import { type TutorToolActions } from "../conversation/tutor-tool-offer";
import { LearnLink } from "../learn-link";
import { BuddyArt } from "./buddy-art";
import { BuddyGlassesSheet } from "./buddy-glasses-sheet";
import { BuddyStageName } from "./buddy-labels";
import { type BuddyStatusView } from "./buddy-status-view";
import { BuddyToday } from "./buddy-today";
import { type LearnBuddy } from "./use-buddy-name";

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
 * Where the buddy tab leads: its Energy over time and the week's summary. Statistics open from the
 * account menu and the level in the top bar.
 */
export type BuddyScreenHrefs = { energy: string; logbook: string };

/**
 * How the buddy tab saves: the buddy (kind, name and glasses), resolving to whether it was saved,
 * and the learner's answer to a plan change the buddy proposed in the conversation.
 */
export type BuddyScreenActions = {
  decidePlanChange: DecideTutorPlanChange;
  saveBuddy: (buddy: AppearanceBuddy) => Promise<boolean>;
  /** How the app tools the buddy offers in the conversation open. */
  tools: TutorToolActions;
};

/**
 * The buddy as the learner sees it right away: a change shows at once and goes back if it didn't
 * save, with `failed` saying so.
 */
function useBuddyChanges({
  initial,
  saveBuddy,
}: {
  initial: AppearanceBuddy | null;
  saveBuddy: BuddyScreenActions["saveBuddy"];
}) {
  const [current, setCurrent] = useState(initial);
  const [failed, setFailed] = useState(false);

  async function save(next: AppearanceBuddy) {
    const previous = current;
    setCurrent(next);
    setFailed(false);

    const { data: saved } = await safeAsync(() => saveBuddy(next));

    if (!saved) {
      setCurrent(previous);
      setFailed(true);
    }
  }

  return { current, failed, save };
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
  buddy: LearnBuddy | null;
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
        render={<Button className="shrink-0 rounded-full" size="icon" variant="outline" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("More about {buddy}", { buddy: name })}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onEdit}>
          {buddy ? <PencilIcon aria-hidden="true" /> : <SmileIcon aria-hidden="true" />}
          {buddy ? t("Change {buddy}", { buddy: name }) : t("Pick your buddy")}
        </DropdownMenuItem>

        {buddy && (
          <DropdownMenuItem onClick={onGlasses}>
            <GlassesIcon aria-hidden="true" />
            <span className="flex-1">{t("Glasses")}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{glassesCount}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<LearnLink href={hrefs.logbook} />}>
          <CalendarDaysIcon aria-hidden="true" />
          {t("Weekly summary")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A learner without a buddy yet is offered one, right above the conversation. */
function PickBuddyRow({ onPick }: { onPick: () => void }) {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowButton aria-haspopup="dialog" onClick={onPick}>
        <ListRowIcon>
          <SmileIcon />
        </ListRowIcon>
        <ListRowContent>
          <ListRowTitle>{t("Pick your buddy")}</ListRowTitle>
          <ListRowDescription>
            {t("It learns with you and grows with your belt.")}
          </ListRowDescription>
        </ListRowContent>
      </ListRowButton>
    </ListGroup>
  );
}

/** "Your study buddy · Baby": what the buddy is, and its stage once there's one to grow. */
function BuddyLine({ stage }: { stage: BuddyStatusView["stage"] | null }) {
  const t = useExtracted();

  if (!stage) {
    return t("Your study buddy");
  }

  return (
    <span>
      {t("Your study buddy")}
      {" · "}
      <BuddyStageName stage={stage} />
    </span>
  );
}

function useGlassesCount(status: BuddyStatusView): string {
  const t = useExtracted();
  const earned = status.glasses.filter((item) => item.earned).length;
  return t("{earned} of {total}", { earned: String(earned), total: String(status.glasses.length) });
}

/**
 * The buddy tab: the learner's conversation with their buddy, their tutor for the goal. The buddy
 * sits on top (its art, name and stage, the rest behind its "…") with its day as two small tiles
 * (Energy and today's missions, their details a tap away); the conversation takes the screen, its
 * suggestions and composer always within reach. Before a buddy is picked, a neutral tutor talks and the tab offers to pick one.
 * The host places the conversation as its child, which reads the buddy with `useBuddyTutor`.
 */
export function BuddyScreen({
  actions,
  children,
  hrefs,
  situation,
  status,
}: {
  actions: BuddyScreenActions;
  /** The conversation, which reads what it needs from `useBuddyTutor`. */
  children: React.ReactNode;
  hrefs: BuddyScreenHrefs;
  situation: TutorSituation;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const [editing, setEditing] = useState(false);
  const [wearing, setWearing] = useState(false);

  const { current, failed, save } = useBuddyChanges({
    initial: status.buddy,
    saveBuddy: actions.saveBuddy,
  });

  const look = { beltColor: status.belt.color, energy: status.energy.current };

  const buddy: LearnBuddy | null = current && {
    ...look,
    ...current,
    studiedToday: status.energy.studiedToday,
  };

  const content = useTutorConversationContent({
    buddy,
    decide: actions.decidePlanChange,
    situation,
    tools: actions.tools,
  });

  const name = content.identity.name;
  const glassesCount = useGlassesCount(status);

  return (
    <div className="-mb-12 flex flex-1 flex-col gap-6" data-slot="buddy-screen">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-4 px-1">
          <BuddyArt buddy={buddy} name={name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <PageTitle className="truncate">{name}</PageTitle>
            <PageSubtitle className="pt-0">
              <BuddyLine stage={buddy ? status.stage : null} />
            </PageSubtitle>
          </div>

          <BuddyMenu
            buddy={buddy}
            glassesCount={glassesCount}
            hrefs={hrefs}
            name={name}
            onEdit={() => setEditing(true)}
            onGlasses={() => setWearing(true)}
          />
        </div>

        <BuddyToday
          energyHref={hrefs.energy}
          hasBuddy={Boolean(buddy)}
          name={name}
          status={status}
        />
      </header>

      {failed && !editing && (
        <p className="text-destructive text-sm" role="alert">
          {t("That didn't save. Try again in a moment.")}
        </p>
      )}

      {!buddy && <PickBuddyRow onPick={() => setEditing(true)} />}

      <TutorContentContext value={content}>{children}</TutorContentContext>

      {buddy && (
        <BuddyGlassesSheet
          buddy={buddy}
          failed={failed}
          glasses={status.glasses}
          onOpenChange={setWearing}
          onWear={(glasses) => void save({ glasses, kind: buddy.kind, name: buddy.name })}
          open={wearing}
        />
      )}

      {editing && (
        <BuddyEditor
          initial={{
            glasses: current?.glasses ?? "round",
            kind: current?.kind ?? "zu",
            name: current?.name ?? "",
          }}
          look={look}
          onClose={() => setEditing(false)}
          onSave={(choice) => {
            setEditing(false);

            void save({
              glasses: choice.glasses,
              kind: choice.kind,
              name: choice.name.trim() || null,
            });
          }}
        />
      )}
    </div>
  );
}
