"use client";

import { getTutorConfig } from "@/lib/learn/tutor-config";
import { AskTutor } from "@zoonk/player/tutor";
import { useMemo } from "react";

/**
 * "Ask" on a learn screen with main's tutor connection and links, so server pages can place it
 * with plain props. Pages that render it need the player's messages (`scope="player"`).
 */
export function MainAskTutor({
  canAsk,
  ...props
}: Omit<React.ComponentProps<typeof AskTutor>, "tutor"> & { canAsk: boolean }) {
  const tutor = useMemo(() => getTutorConfig({ canAsk }), [canAsk]);
  return <AskTutor {...props} tutor={tutor} />;
}
