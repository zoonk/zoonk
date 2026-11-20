"use client";

import { useRouter } from "@/i18n/navigation";
import { startWritingFromBrowser } from "@/lib/essays/writing-requests";
import { WritingStartScreen, type WritingStartState } from "@zoonk/learn/writing/start";

const HREFS = { exit: "/today" };

/**
 * The block's question isn't there yet: it's being written, a try failed, or the day's extra
 * grades are used, and then the task stays on Today for tomorrow.
 */
export function WritingStartClient({
  blockId,
  initial,
}: {
  blockId: string;
  initial: WritingStartState;
}) {
  const router = useRouter();

  return (
    <WritingStartScreen
      finish={async () => {
        router.push(HREFS.exit);
        return true;
      }}
      hrefs={HREFS}
      initial={initial}
      onReady={() => router.replace(`/essay/${encodeURIComponent(blockId)}`)}
      start={async () => {
        const answer = await startWritingFromBrowser({ blockId });
        return answer === "notWriting" ? { status: "failed" } : answer;
      }}
    />
  );
}
