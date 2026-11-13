"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { safeAsync } from "@zoonk/utils/error";
import { PauseIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type TransitionStartFunction, useId, useState } from "react";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { SheetHeader } from "../_components/sheet-header";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { GoalCountryName, GoalMark } from "./goal-mark";
import { type WaitingGoal } from "./goal-menu-row";

type PausableGoal = {
  displayName: string;
  id: string;
  languageFlag: string | null;
  targetLanguage: string | null;
  targetRegion: string | null;
};

export type WaitingStart = { pauseGoalId?: string; waitingGoalId: string };

type MakeRoomState = {
  failed: boolean;
  open: boolean;
  pausingId: string | null;
  waiting: WaitingGoal;
};

/** The switcher's transition runs the start, so the page under the sheet dims as for a goal switch. */
export function useMakeRoom({
  isStarting,
  onStartWaiting,
  startTransition,
}: {
  isStarting: boolean;
  onStartWaiting: (start: WaitingStart) => Promise<boolean>;
  startTransition: TransitionStartFunction;
}) {
  const [state, setState] = useState<MakeRoomState | null>(null);

  const pause = (pauseGoalId: string) => {
    if (!state || isStarting) {
      return;
    }

    const { waiting } = state;
    setState({ failed: false, open: true, pausingId: pauseGoalId, waiting });

    startTransition(async () => {
      const { data: started } = await safeAsync(() =>
        onStartWaiting({ pauseGoalId, waitingGoalId: waiting.id }),
      );

      setState({ failed: !started, open: !started, pausingId: pauseGoalId, waiting });
    });
  };

  return {
    open: (waiting: WaitingGoal) =>
      setState({ failed: false, open: true, pausingId: null, waiting }),
    pause,
    setOpen: (open: boolean) => setState(state && { ...state, open }),
    state,
  };
}

function PausableGoalRow({
  goal,
  isStarting,
  onPause,
  pausing,
}: {
  goal: PausableGoal;
  isStarting: boolean;
  onPause: () => void;
  pausing: boolean;
}) {
  const t = useExtracted("goalSwitcher");
  const id = useId();
  const nameId = `${id}-name`;
  const pauseId = `${id}-pause`;

  return (
    <ListRow className="items-center" role="listitem">
      <ListRowLeading>
        <GoalMark goal={goal} />
      </ListRowLeading>

      <ListRowContent>
        <ListRowTitle id={nameId}>
          {goal.displayName}
          <GoalCountryName goal={goal} />
        </ListRowTitle>
      </ListRowContent>

      <Button
        aria-labelledby={`${pauseId} ${nameId}`}
        busy={isStarting && pausing}
        disabled={isStarting && !pausing}
        icon={<PauseIcon aria-hidden="true" />}
        id={pauseId}
        onClick={onPause}
        size="sm"
        variant="outline"
      >
        {t("Pause")}
      </Button>
    </ListRow>
  );
}

/**
 * The switcher's own namespace only: it also opens over public pages, which carry no other learn
 * messages.
 */
export function MakeRoomSheet({
  goals,
  isStarting,
  room,
}: {
  goals: PausableGoal[];
  isStarting: boolean;
  room: ReturnType<typeof useMakeRoom>;
}) {
  const t = useExtracted("goalSwitcher");
  const routes = useLearnRoutes();
  const { state } = room;

  if (!state) {
    return null;
  }

  const goal = state.waiting.displayName;

  return (
    <Drawer onOpenChange={(open) => !isStarting && room.setOpen(open)} open={state.open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle className="text-balance">{t("Make room for {goal}", { goal })}</DrawerTitle>
          <DrawerDescription className="text-pretty">
            {t("That's as many goals as you can study at once. Pause one to start this one.")}
          </DrawerDescription>
        </SheetHeader>

        <DrawerContent className="flex flex-col gap-4 pt-2">
          <ListGroup aria-label={t("Your goals")} role="list" variant="panel">
            {goals.map((pausable) => (
              <PausableGoalRow
                goal={pausable}
                isStarting={isStarting}
                key={pausable.id}
                onPause={() => room.pause(pausable.id)}
                pausing={state.pausingId === pausable.id}
              />
            ))}
          </ListGroup>

          {state.failed && !isStarting && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("We couldn't start this goal. Try again.")}
            </p>
          )}

          <LearnLink
            className={buttonVariants({
              className: "sm:self-start",
              size: "lg",
              variant: "outline",
            })}
            href={routes.upgrade}
            onClick={() => room.setOpen(false)}
          >
            {t("Subscribe")}
          </LearnLink>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
