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
  learningDays: number;
  localDate: string;
  todayBrainPower: number;
  todayCompletedLessons: number;
  todayEnergyAtEnd: number | null;
  todayInteractiveLessons: number;
  totalLearningSeconds: number;
};

/**
 * Storage can be absent during server rendering or restricted browser modes.
 * Keeping the guard in one place lets callers stay focused on milestone logic.
 */
function getSessionStorage() {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    return globalThis.window.sessionStorage;
  } catch {
    return null;
  }
}

function getSessionStorageItem(key: string) {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionStorageItem(key: string, value: string) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, value);
  } catch {
    // Completion storage is a best-effort cache; persistence must continue.
  }
}

/**
 * Stored progress can come from an older tab payload that predates newer
 * milestone fields. Centralizing this fallback keeps backward-compatible
 * parsing readable while still requiring core fields above to be valid.
 */
function getStoredNumber({ value }: { value: unknown }): number;
function getStoredNumber({ fallback, value }: { fallback: null; value: unknown }): number | null;

function getStoredNumber({ fallback = 0, value }: { fallback?: number | null; value: unknown }) {
  return typeof value === "number" ? value : fallback;
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
      learningDays: getStoredNumber({ value: progress.learningDays }),
      localDate: progress.localDate,
      todayBrainPower: progress.todayBrainPower,
      todayCompletedLessons: getStoredNumber({ value: progress.todayCompletedLessons }),
      todayEnergyAtEnd: getStoredNumber({ fallback: null, value: progress.todayEnergyAtEnd }),
      todayInteractiveLessons: getStoredNumber({ value: progress.todayInteractiveLessons }),
      totalLearningSeconds: getStoredNumber({ value: progress.totalLearningSeconds }),
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
  const storedProgress = parseStoredCompletionProgress(getSessionStorageItem(PROGRESS_STORAGE_KEY));

  if (!storedProgress || storedProgress.localDate !== localDate) {
    return progressSnapshot;
  }

  if (!progressSnapshot) {
    return {
      bestDayScores: [],
      currentEnergy: storedProgress.currentEnergy,
      fullEnergyDays: storedProgress.fullEnergyDays,
      highestPreviousDailyBrainPower: 0,
      learningDays: storedProgress.learningDays,
      todayBrainPower: storedProgress.todayBrainPower,
      todayCompletedLessons: storedProgress.todayCompletedLessons,
      todayEnergyAtEnd: storedProgress.todayEnergyAtEnd,
      todayInteractiveLessons: storedProgress.todayInteractiveLessons,
      totalLearningSeconds: storedProgress.totalLearningSeconds,
    };
  }

  return {
    ...progressSnapshot,
    bestDayScores: progressSnapshot.bestDayScores ?? [],
    currentEnergy: Math.max(progressSnapshot.currentEnergy, storedProgress.currentEnergy),
    fullEnergyDays: Math.max(progressSnapshot.fullEnergyDays, storedProgress.fullEnergyDays),
    learningDays: Math.max(progressSnapshot.learningDays ?? 0, storedProgress.learningDays),
    todayBrainPower: Math.max(progressSnapshot.todayBrainPower, storedProgress.todayBrainPower),
    todayCompletedLessons: Math.max(
      progressSnapshot.todayCompletedLessons ?? 0,
      storedProgress.todayCompletedLessons,
    ),
    todayEnergyAtEnd: Math.max(
      progressSnapshot.todayEnergyAtEnd ?? 0,
      storedProgress.todayEnergyAtEnd ?? 0,
    ),
    todayInteractiveLessons: Math.max(
      progressSnapshot.todayInteractiveLessons ?? 0,
      storedProgress.todayInteractiveLessons,
    ),
    totalLearningSeconds: Math.max(
      progressSnapshot.totalLearningSeconds ?? 0,
      storedProgress.totalLearningSeconds,
    ),
  };
}

/**
 * Browser storage is only available after hydration. Returning an empty list on
 * the server keeps the initial render deterministic, while client navigations
 * can still suppress milestones already shown in the same tab.
 */
export function getStoredCompletionMilestoneKeys(): PlayerCompletionMilestoneKey[] {
  const rawValue = getSessionStorageItem(MILESTONE_KEYS_STORAGE_KEY);

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
  completion: Pick<
    CompletionResult,
    "brainPower" | "correctCount" | "energyDelta" | "incorrectCount"
  > & { completedInteractiveLesson?: boolean; lessonDurationSeconds?: number };
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}): StoredCompletionProgress | null {
  if (!progressSnapshot) {
    return null;
  }

  const currentEnergy = clampEnergy(progressSnapshot.currentEnergy + completion.energyDelta);
  const todayWasAlreadyFull = (progressSnapshot.todayEnergyAtEnd ?? 0) >= FULL_ENERGY;
  const todayIsNowFull = currentEnergy >= FULL_ENERGY;

  const completedNewLearningDay = (progressSnapshot.todayCompletedLessons ?? 0) === 0;

  return {
    currentEnergy,
    fullEnergyDays:
      progressSnapshot.fullEnergyDays + (!todayWasAlreadyFull && todayIsNowFull ? 1 : 0),
    learningDays: (progressSnapshot.learningDays ?? 0) + (completedNewLearningDay ? 1 : 0),
    localDate,
    todayBrainPower: progressSnapshot.todayBrainPower + completion.brainPower,
    todayCompletedLessons: (progressSnapshot.todayCompletedLessons ?? 0) + 1,
    todayEnergyAtEnd: currentEnergy,
    todayInteractiveLessons:
      (progressSnapshot.todayInteractiveLessons ?? 0) +
      (completion.completedInteractiveLesson ? 1 : 0),
    totalLearningSeconds:
      (progressSnapshot.totalLearningSeconds ?? 0) + (completion.lessonDurationSeconds ?? 0),
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
  completion: Pick<
    CompletionResult,
    "brainPower" | "correctCount" | "energyDelta" | "incorrectCount"
  > & { completedInteractiveLesson?: boolean; lessonDurationSeconds?: number };
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}) {
  const nextProgress = getNextStoredCompletionProgress({ completion, localDate, progressSnapshot });

  if (!nextProgress) {
    return;
  }

  setSessionStorageItem(PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
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
  if (milestones.length === 0) {
    return;
  }

  const existingKeys = getStoredCompletionMilestoneKeys();

  const nextKeys = milestones.map((milestone) =>
    getCompletionMilestoneKey({ localDate, milestone }),
  );

  const uniqueKeys = [...new Set([...existingKeys, ...nextKeys])].slice(-MAX_STORED_MILESTONE_KEYS);

  setSessionStorageItem(MILESTONE_KEYS_STORAGE_KEY, JSON.stringify(uniqueKeys));
}
