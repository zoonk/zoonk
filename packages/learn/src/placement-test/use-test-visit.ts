"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { type TestPressed } from "./test-offer";

/**
 * A visit to a test screen: the read that opens it and the saves made from it. A screen kept from
 * an earlier visit, such as a question the learner left and came back to, can't be pressed until
 * this visit has read where the test is. A read lands only on the screen it was sent from: once
 * the screen is hidden or the learner pressed something, it no longer says where they are.
 */
export function useTestVisit<Read>({
  onRead,
  opened: openedAtFirst = false,
  read,
}: {
  /** Gets null when the read failed. */
  onRead: (data: Read | null) => Promise<void>;
  /** The first visit opens on what the server rendered for it, so it can be pressed at once. */
  opened?: boolean;
  read: () => Promise<Read>;
}) {
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<TestPressed>(null);
  const [isPending, startTransition] = useTransition();
  const [opened, setOpened] = useState(openedAtFirst);
  const screen = useRef(0);

  const readNow = async () => {
    screen.current += 1;
    const sentFrom = screen.current;
    const { data } = await safeAsync(read);

    if (sentFrom === screen.current) {
      await onRead(data);
      setOpened(true);
    }
  };

  const readOnOpen = useEffectEvent(readNow);

  useEffect(() => {
    void readOnOpen();

    return () => {
      screen.current += 1;
      setOpened(false);
    };
  }, []);

  /** For a save with its own failure state, such as an answer counted on its question. */
  const run = (action: () => Promise<void>) => {
    if (!opened) {
      return;
    }

    screen.current += 1;
    setFailed(false);
    startTransition(action);
  };

  return {
    failed,
    isPending: isPending || !opened,
    pressed,
    reopen: readNow,
    run,
    save: (button: TestPressed, action: () => Promise<boolean>) => {
      if (!opened) {
        return;
      }

      setPressed(button);

      run(async () => {
        const saved = await action().catch(() => false);
        setFailed(!saved);
        setPressed(null);
      });
    },
    setFailed,
  };
}
