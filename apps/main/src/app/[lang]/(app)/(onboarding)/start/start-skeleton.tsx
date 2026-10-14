"use client";

import { StartEntrySkeleton, StartWaitSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { useSearchParams } from "next/navigation";
import { DRAFT_PARAM } from "./start-params";

/**
 * `/start` while it loads, in the shape of the screen that comes: the wait for a goal the address
 * carries (`?draft=`, the home page's field sends it here), the first screen otherwise.
 */
export function StartSkeleton() {
  const searchParams = useSearchParams();

  return searchParams.has(DRAFT_PARAM) ? <StartWaitSkeleton /> : <StartEntrySkeleton />;
}
