"use client";

import { useEffect, useState } from "react";

export type ThinkingMessageGenerator = (index: number) => string;

/**
 * Cycles through an array of messages based on the index.
 * Returns the message at `index % messages.length`.
 */
export function cycleMessage(messages: string[], index: number): string {
  return messages[index % messages.length] ?? "";
}

const DEFAULT_REVIEW_INTERVAL = 3;
const ITEM_NUMBER_SCALE = 0.7;

/**
 * Creates a generator that produces incrementing "item N..." messages
 * with periodic review messages interspersed.
 *
 * @param intro - Messages to show before the numbered sequence
 * @param itemTemplate - Function that returns the "item N..." message
 * @param reviewMessage - Periodic message shown every `reviewInterval` items
 * @param reviewInterval - How often to show the review message (default: 3)
 */
export function createCountingGenerator(config: {
  intro: string[];
  itemTemplate: (num: number) => string;
  reviewInterval?: number;
  reviewMessage: string;
}): ThinkingMessageGenerator {
  const interval = config.reviewInterval ?? DEFAULT_REVIEW_INTERVAL;

  return (index) => {
    if (index < config.intro.length) {
      return config.intro[index] ?? "";
    }

    const itemIndex = index - config.intro.length;

    if (itemIndex % interval === interval - 1) {
      return config.reviewMessage;
    }

    return config.itemTemplate(Math.ceil((itemIndex + 1) * ITEM_NUMBER_SCALE));
  };
}

const MIN_INTERVAL = 1500;
const MAX_INTERVAL = 3000;

function getRandomInterval(): number {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

/**
 * Cycles through contextual "thinking" messages at randomized intervals.
 * Each active phase gets its own independent message counter.
 *
 * @param generators - Map of phase names to their message generators
 * @param activePhases - Set of phase names currently active
 * @returns Map of phase name → current thinking message
 */
export function useThinkingMessages<TPhase extends string>(
  generators: Record<TPhase, ThinkingMessageGenerator>,
  activePhases: TPhase[],
): Record<string, string> {
  const [index, setIndex] = useState(0);
  const hasActive = activePhases.length > 0;

  useEffect(() => {
    if (!hasActive) {
      setIndex(0);
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, getRandomInterval());

    return () => {
      clearTimeout(timeout);
    };
  }, [hasActive, index]);

  if (!hasActive) {
    return {};
  }

  return Object.fromEntries(
    activePhases
      .map((phase) => [phase, generators[phase]?.(index)] as const)
      .filter(([, message]) => message !== undefined),
  );
}
