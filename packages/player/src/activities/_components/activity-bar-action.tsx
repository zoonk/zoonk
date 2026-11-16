"use client";

import { EnterButton } from "@zoonk/learn/enter-button";
import { MainActionInBar } from "@zoonk/learn/main-action-slot";
import { TaskActionLabel } from "@zoonk/learn/task-layout";

/**
 * A step that needs a run or a start before it can be checked draws that action in the bar, where
 * Check is, until there is something to check: the screen has one main action at a time and its
 * order needs no words.
 */
export function ActivityBarAction({
  busy = false,
  children,
  disabled = false,
  onPress,
}: {
  busy?: boolean;
  children: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <MainActionInBar>
      <EnterButton
        busy={busy}
        data-slot="activity-bar-action"
        disabled={disabled}
        onClick={onPress}
      >
        <TaskActionLabel>{children}</TaskActionLabel>
      </EnterButton>
    </MainActionInBar>
  );
}
