"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { type ContentWriting } from "../generation/writing-wait";
import { useLearnAnalytics } from "../learn-context";
import { type PlanActions, usePlanScreen } from "./plan-context";

type ToolChoiceInput = Parameters<PlanActions["chooseTools"]>[0];

type PendingChoice = { generationId: string; input: ToolChoiceInput; onDone?: () => void };

/**
 * A setup lesson nobody has needed yet is written first; the same choice is sent again once it
 * is, and asking again after that fails rather than waiting forever.
 */
export function useToolChoice() {
  const { actions } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<PendingChoice | null>(null);

  const send = ({
    afterWrite,
    input,
    onDone,
  }: {
    afterWrite: boolean;
    input: ToolChoiceInput;
    onDone?: () => void;
  }) => {
    setFailed(false);

    startTransition(async () => {
      const { data } = await safeAsync(() => actions.chooseTools(input));

      if (data && typeof data === "object" && !afterWrite) {
        setPending({ generationId: data.generationId, input, onDone });
        return;
      }

      setPending(null);
      setFailed(data !== true);

      if (data === true) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setTools" } });
        onDone?.();
      }
    });
  };

  const writing: ContentWriting | null = pending
    ? {
        generationId: pending.generationId,
        onReady: () => send({ ...pending, afterWrite: true }),
        restart: async () => {
          send({ ...pending, afterWrite: false });
        },
      }
    : null;

  return {
    choose: (input: ToolChoiceInput, onDone?: () => void) =>
      send({ afterWrite: false, input, onDone }),
    failed,
    isPending,
    writing,
  };
}
