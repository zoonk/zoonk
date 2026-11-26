"use client";

import { ORIGIN_PARAM } from "@/lib/public/public-hrefs";
import { trackEvent } from "@zoonk/core/analytics/client";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { type ReactNode, useRef } from "react";

/**
 * A plain GET form, so an answer opens the player even before the page's scripts load. Once they
 * have, each option's number key presses it, as the keycap it shows says.
 */
export function FirstAnswerForm({
  action,
  children,
  count,
  label,
  lessonId,
  origin,
}: {
  action: string;
  children: ReactNode;
  count: number;
  label: string;
  lessonId: string;
  origin: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  useNumberKeys({
    count,
    onPick: (index) => {
      form.current?.querySelectorAll<HTMLButtonElement>("button[type=submit]")[index]?.click();
    },
  });

  return (
    <form
      action={action}
      aria-label={label}
      method="get"
      ref={form}
      onSubmit={() => trackEvent({ name: "Hook Answered", properties: { lesson_id: lessonId } })}
    >
      <input name={ORIGIN_PARAM} type="hidden" value={origin} />
      {children}
    </form>
  );
}
