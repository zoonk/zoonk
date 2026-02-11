"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { isJsonObject } from "@zoonk/utils/json";
import { useCallback, useState } from "react";
import {
  PLAYER_STATE_VERSION,
  type PlayerAction,
  type PlayerState,
  createInitialState,
  playerReducer,
} from "./player-reducer";

export function playerStorageKey(activityId: string): string {
  return `zoonk:player:${activityId}`;
}

function loadPersistedState(activityId: string): PlayerState | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(playerStorageKey(activityId));

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isJsonObject(parsed) || parsed.version !== PLAYER_STATE_VERSION) {
      return null;
    }

    // oxlint-disable-next-line no-unsafe-type-assertion -- version-gated self-written sessionStorage data
    return parsed as PlayerState;
  } catch {
    return null;
  }
}

function persistState(state: PlayerState): void {
  try {
    sessionStorage.setItem(playerStorageKey(state.activityId), JSON.stringify(state));
  } catch {
    // setItem throws on quota exceeded or in private browsing
  }
}

export function usePlayerState(activity: SerializedActivity) {
  const [state, setState] = useState<PlayerState>(
    () => loadPersistedState(activity.id) ?? createInitialState(activity),
  );

  const dispatch = useCallback((action: PlayerAction) => {
    setState((prev) => {
      const next = playerReducer(prev, action);

      if (next.phase === "completed") {
        sessionStorage.removeItem(playerStorageKey(next.activityId));
      } else {
        persistState(next);
      }

      return next;
    });
  }, []);

  return { dispatch, state };
}
