"use client";

import { ORIGIN_PARAM } from "@/lib/public/public-hrefs";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type ReactNode } from "react";

/** A plain GET form, so an answer opens the player even before the page's scripts load. */
export function FirstAnswerForm({
  action,
  children,
  label,
  lessonId,
  origin,
}: {
  action: string;
  children: ReactNode;
  label: string;
  lessonId: string;
  origin: string;
}) {
  return (
    <form
      action={action}
      aria-label={label}
      method="get"
      onSubmit={() => trackEvent({ name: "Hook Answered", properties: { lesson_id: lessonId } })}
    >
      <input name={ORIGIN_PARAM} type="hidden" value={origin} />
      {children}
    </form>
  );
}
