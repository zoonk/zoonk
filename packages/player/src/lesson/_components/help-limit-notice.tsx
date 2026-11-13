"use client";

import { type HelpKind, type HelpLimit, HelpLimitNotice } from "@zoonk/learn/help-limit";
import { useLessonPlayerConfig } from "../lesson-player-context";

export function LessonHelpLimitNotice({
  className,
  kind,
  limit,
}: {
  className?: string;
  kind?: HelpKind;
  limit: HelpLimit;
}) {
  const { linkComponent, routes } = useLessonPlayerConfig();

  return (
    <HelpLimitNotice
      className={className}
      kind={kind}
      limit={limit}
      linkComponent={linkComponent}
      routes={routes}
    />
  );
}
