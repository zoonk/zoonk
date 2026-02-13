"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useCallback, useState } from "react";
import {
  type PlayerAction,
  type PlayerState,
  createInitialState,
  playerReducer,
} from "./player-reducer";

export function usePlayerState(activity: SerializedActivity) {
  const [state, setState] = useState<PlayerState>(() => createInitialState(activity));

  const dispatch = useCallback((action: PlayerAction) => {
    setState((prev) => playerReducer(prev, action));
  }, []);

  return { dispatch, state };
}
