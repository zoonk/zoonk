import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { clampEnergy } from "@zoonk/utils/energy";
import {
  type PlayerCompletionMilestoneKey,
  getCompletionMilestoneKey,
} from "./completion-milestone-keys";
import {
  type PlayerCompletionMilestone,
  type PlayerProgressSnapshot,
} from "./completion-milestones";

const MILESTONE_KEYS_STORAGE_KEY = "zoonk-player-shown-completion-milestones";
const PROGRESS_STORAGE_KEY = "zoonk-player-completion-progress";
const MAX_STORED_MILESTONE_KEYS = 200;
const FULL_ENERGY = 100;

type StoredCompletionProgress = {
  currentEnergy: number;
  fullEnergyDays: number;
  localDate: string;
  todayBrainPower: number;
  todayEnergyAtEnd: number | null;
};

/**
 * Storage can be absent during server rendering or restricted browser modes.
 * Keeping the guard in one place lets callers stay focused on milestone logic.
 */
function getSessionStorage() {
  return globalThis.sessionStorage;
}

/**
 * Parses the stored progress override conservatively so a corrupted value never
 * blocks milestone screens.
 */
function parseStoredCompletionProgress(rawValue: string | null): StoredCompletionProgress | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const progress = parsed as Partial<StoredCompletionProgress>;

    if (
      typeof progress.currentEnergy !== "number" ||
      typeof progress.fullEnergyDays !== "number" ||
      typeof progress.localDate !== "string" ||
      typeof progress.todayBrainPower !== "number"
    ) {
      return null;
    }

    return {
      currentEnergy: progress.currentEnergy,
      fullEnergyDays: progress.fullEnergyDays,
      localDate: progress.localDate,
      todayBrainPower: progress.todayBrainPower,
      todayEnergyAtEnd:
        typeof progress.todayEnergyAtEnd === "number" ? progress.todayEnergyAtEnd : null,
    };
  } catch {
    return null;
  }
}

/**
 * A stored same-day progress value is more recent than a prefetched server
 * snapshot. Merging with max values preserves newer local progress without
 * hiding fresh server progress after a normal page reload.
 */
export function getEffectiveCompletionProgressSnapshot({
  localDate,
  progressSnapshot,
}: {
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}): PlayerProgressSnapshot | null {
  const storage = getSessionStorage();

  const storedProgress = parseStoredCompletionProgress(
    storage?.getItem(PROGRESS_STORAGE_KEY) ?? null,
  );

  if (!storedProgress || storedProgress.localDate !== localDate) {
    return progressSnapshot;
  }

  if (!progressSnapshot) {
    return {
      currentEnergy: storedProgress.currentEnergy,
      fullEnergyDays: storedProgress.fullEnergyDays,
      highestPreviousDailyBrainPower: 0,
      todayBrainPower: storedProgress.todayBrainPower,
      todayEnergyAtEnd: storedProgress.todayEnergyAtEnd,
    };
  }

  return {
    ...progressSnapshot,
    currentEnergy: Math.max(progressSnapshot.currentEnergy, storedProgress.currentEnergy),
    fullEnergyDays: Math.max(progressSnapshot.fullEnergyDays, storedProgress.fullEnergyDays),
    todayBrainPower: Math.max(progressSnapshot.todayBrainPower, storedProgress.todayBrainPower),
    todayEnergyAtEnd: Math.max(
      progressSnapshot.todayEnergyAtEnd ?? 0,
      storedProgress.todayEnergyAtEnd ?? 0,
    ),
  };
}

/**
 * Browser storage is only available after hydration. Returning an empty list on
 * the server keeps the initial render deterministic, while client navigations
 * can still suppress milestones already shown in the same tab.
 */
export function getStoredCompletionMilestoneKeys(): PlayerCompletionMilestoneKey[] {
  const storage = getSessionStorage();

  if (!storage) {
    return [];
  }

  const rawValue = storage.getItem(MILESTONE_KEYS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((key): key is string => typeof key === "string");
  } catch {
    return [];
  }
}

/**
 * Builds the local progress value that should be used by later lessons in this
 * tab. This is the same client-side score preview used by the milestone screen.
 */
function getNextStoredCompletionProgress({
  completion,
  localDate,
  progressSnapshot,
}: {
  completion: Pick<CompletionResult, "brainPower" | "energyDelta">;
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}): StoredCompletionProgress | null {
  if (!progressSnapshot) {
    return null;
  }

  const currentEnergy = clampEnergy(progressSnapshot.currentEnergy + completion.energyDelta);
  const todayWasAlreadyFull = (progressSnapshot.todayEnergyAtEnd ?? 0) >= FULL_ENERGY;
  const todayIsNowFull = currentEnergy >= FULL_ENERGY;

  return {
    currentEnergy,
    fullEnergyDays:
      progressSnapshot.fullEnergyDays + (!todayWasAlreadyFull && todayIsNowFull ? 1 : 0),
    localDate,
    todayBrainPower: progressSnapshot.todayBrainPower + completion.brainPower,
    todayEnergyAtEnd: currentEnergy,
  };
}

/**
 * Saves the latest client-known progress so prefetched lesson pages do not keep
 * deriving milestones from an older server snapshot.
 */
export function rememberCompletionProgress({
  completion,
  localDate,
  progressSnapshot,
}: {
  completion: Pick<CompletionResult, "brainPower" | "energyDelta">;
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}) {
  const storage = getSessionStorage();
  const nextProgress = getNextStoredCompletionProgress({ completion, localDate, progressSnapshot });

  if (!storage || !nextProgress) {
    return;
  }

  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
}

/**
 * Milestones are remembered as soon as the completed state is reached. The
 * current flow can still show every screen because reducer state already holds
 * the pre-existing keys; future prefetched lessons receive the updated list.
 */
export function rememberCompletionMilestones({
  localDate,
  milestones,
}: {
  localDate: string;
  milestones: PlayerCompletionMilestone[];
}) {
  const storage = getSessionStorage();

  if (!storage || milestones.length === 0) {
    return;
  }

  const existingKeys = getStoredCompletionMilestoneKeys();

  const nextKeys = milestones.map((milestone) =>
    getCompletionMilestoneKey({ localDate, milestone }),
  );

  const uniqueKeys = [...new Set([...existingKeys, ...nextKeys])].slice(-MAX_STORED_MILESTONE_KEYS);

  storage.setItem(MILESTONE_KEYS_STORAGE_KEY, JSON.stringify(uniqueKeys));
}
