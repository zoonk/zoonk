"use client";

import { type HelpLimit, HelpLimitNotice } from "@zoonk/learn/help-limit";
import { useLessonPlayerConfig } from "../lesson-player-context";

/** The shared notice for small AI help the lesson can't give now, with the player's links. */
export function LessonHelpLimitNotice({
  className,
  limit,
}: {
  className?: string;
  limit: HelpLimit;
}) {
  const { linkComponent, routes } = useLessonPlayerConfig();

  return (
    <HelpLimitNotice
      className={className}
      limit={limit}
      linkComponent={linkComponent}
      routes={routes}
    />
  );
}
