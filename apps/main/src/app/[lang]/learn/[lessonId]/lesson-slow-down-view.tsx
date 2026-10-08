"use client";

import { useRouter } from "@/i18n/navigation";
import { LessonSlowDown } from "@zoonk/player/lesson/slow-down";
import { useCallback, useState } from "react";

/**
 * Reading lessons' screens too fast (the `lesson-steps` limit): the lesson reloads when the wait
 * is over, and waits again if it's still too soon.
 */
export function LessonSlowDownView({ retryAfterSeconds }: { retryAfterSeconds: number }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
    router.refresh();
  }, [router]);

  return (
    <main className="bg-background flex min-h-dvh flex-col">
      <LessonSlowDown key={attempt} onRetry={retry} retryAfterSeconds={retryAfterSeconds} />
    </main>
  );
}
