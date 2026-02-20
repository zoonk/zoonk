"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useReducer } from "react";
import { createInitialState, playerReducer } from "./player-reducer";

export function usePlayerState(activity: SerializedActivity) {
  const [state, dispatch] = useReducer(playerReducer, activity, createInitialState);
  return { dispatch, state };
}
